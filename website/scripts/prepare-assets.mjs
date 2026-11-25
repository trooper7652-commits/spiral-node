// Build step (predev/prebuild): zip the OS, copy self-hosted Pyodide, verify wheels.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const here = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(["__pycache__", "tests"]);
const CORE = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

// Files under dir (relative, forward slashes, sorted) so the zip is deterministic.
function walk(dir, rel = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, r));
    else out.push(r);
  }
  return out;
}

export function buildOsZip(osDir, scriptsDir = join(osDir, "../scripts")) {
  const files = {};
  for (const r of walk(join(osDir, "spiral"))) files[`spiral/${r}`] = readFileSync(join(osDir, "spiral", r));
  // community scripts run as built-ins in the browser; TEMPLATE is the contributors' example, not a script
  for (const id of existsSync(scriptsDir) ? readdirSync(scriptsDir).sort() : []) {
    const dir = join(scriptsDir, id);
    if (id === "TEMPLATE" || !existsSync(join(dir, "script.py"))) continue;
    if (existsSync(join(osDir, "spiral/builtin_scripts", id))) throw new Error(`scripts/${id}: same id as a built-in script`);
    for (const r of walk(dir)) files[`spiral/builtin_scripts/${id}/${r}`] = readFileSync(join(dir, r));
  }
  files["welcome-messages.txt"] = readFileSync(join(osDir, "welcome-messages.txt"));
  // fixed mtime keeps the output byte-identical between runs; local midnight because zip
  // times are local, so a UTC date would shift the bytes with the builder's timezone
  return zipSync(files, { level: 6, mtime: new Date(2000, 0, 1) });
}

// Throws unless every wheel in wheelDir is in the lock file with a matching sha256.
export function verifyWheels(wheelDir, lockPath) {
  const pkgs = Object.values(JSON.parse(readFileSync(lockPath, "utf8")).packages);
  for (const f of readdirSync(wheelDir).filter((n) => n.endsWith(".whl")).sort()) {
    const entry = pkgs.find((p) => p.file_name === f);
    if (!entry) throw new Error(`${f}: not listed in pyodide-lock.json`);
    const got = createHash("sha256").update(readFileSync(join(wheelDir, f))).digest("hex");
    if (got !== entry.sha256) throw new Error(`${f}: sha256 mismatch (lock ${entry.sha256}, file ${got})`);
  }
}

// Data for the /today page: events split by month, plus facts and questions from two built-in scripts.
export function buildToday(osDir) {
  const read = (script, f) => JSON.parse(readFileSync(join(osDir, "spiral/builtin_scripts", script, f), "utf8"));
  const months = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, "0"), []]));
  for (const e of read("on_this_day", "events.json")) {
    months[e.topic.slice(0, 2)].push({ id: e.id, text: e.text, topic: e.topic, source: e.source });
  }
  const scripts = ["fun_fact_question", "space_facts"];
  return {
    months,
    facts: {
      facts: scripts.flatMap((s) => read(s, "facts.json")).map(({ id, text, source }) => ({ id, text, source })),
      questions: scripts.flatMap((s) => read(s, "questions.json")).map(({ id, text }) => ({ id, text })),
    },
  };
}

// Tag ids the pixel scenes must carry (art/pixel/site-ids.json): the design features, the device parts, one per roadmap stop, one per question.
export function siteIds(siteDir = resolve(here, "..")) {
  const src = (f) => readFileSync(join(siteDir, f), "utf8");
  const count = (text, start, re) => (text.slice(text.indexOf("= [", text.indexOf(start))).split("];")[0].match(re) ?? []).length;
  const content = src("lib/content.ts");
  const n = (k, len) => Array.from({ length: len }, (_, i) => `${k}${i + 1}`);
  return {
    s3: [...src("lib/features.ts").matchAll(/^\s+id: "([a-z]+)"/gm)].map((m) => m[1]),
    s4: ["screen", "wheel", "keys", "body", "port"],
    s6: n("r", count(content, "export const ROADMAP", /\{ text:/g)),
    s7: n("q", count(content, "export const FAQ", /\{ q:/g)),
  };
}

export function prepare({
  siteDir = resolve(here, ".."),
  osDir = resolve(here, "../../os"),
  publicDir = resolve(here, "../public"),
} = {}) {
  const pyDir = join(siteDir, "node_modules/pyodide");
  const vendor = join(siteDir, "vendor/pyodide");
  verifyWheels(vendor, join(pyDir, "pyodide-lock.json"));
  mkdirSync(join(publicDir, "pyodide"), { recursive: true });
  const zip = join(publicDir, "spiral-os.zip");
  // Vercel may upload only this folder, so ../os can be absent there: fall back to the committed
  // zip, which tests/unit/prepare-assets.test.ts keeps byte-identical to the OS source.
  if (existsSync(join(osDir, "spiral"))) {
    writeFileSync(zip, buildOsZip(osDir));
    const today = buildToday(osDir);
    mkdirSync(join(publicDir, "today"), { recursive: true });
    for (const [m, events] of Object.entries(today.months)) writeFileSync(join(publicDir, "today", `otd-${m}.json`), JSON.stringify(events));
    writeFileSync(join(publicDir, "today", "facts.json"), JSON.stringify(today.facts));
  } else if (existsSync(zip)) console.log("prepare-assets: ../os not found, using committed public/spiral-os.zip");
  else throw new Error(`OS source not found at ${osDir} and no committed public/spiral-os.zip`);
  writeFileSync(join(siteDir, "art/pixel/site-ids.json"), JSON.stringify(siteIds(siteDir), null, 1) + "\n");
  for (const f of CORE) cpSync(join(pyDir, f), join(publicDir, "pyodide", f));
  for (const f of readdirSync(vendor).filter((n) => n.endsWith(".whl"))) cpSync(join(vendor, f), join(publicDir, "pyodide", f));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    prepare();
    console.log("prepare-assets: ok");
  } catch (e) {
    console.error(`prepare-assets: ${e.message}`);
    process.exit(1);
  }
}
