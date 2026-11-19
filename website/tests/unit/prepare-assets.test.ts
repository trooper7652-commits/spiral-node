import { mkdtempSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { buildOsZip, verifyWheels, prepare } from "../../scripts/prepare-assets.mjs";

const site = resolve(__dirname, "../..");
const osDir = resolve(site, "../os");
const tmp = () => mkdtempSync(join(tmpdir(), "spiral-assets-"));

describe("prepare-assets", () => {
  it("zips the OS with spiral/ layout and welcome-messages.txt, no __pycache__ or tests", () => {
    const names = Object.keys(unzipSync(buildOsZip(osDir)));
    for (const n of [
      "spiral/__init__.py",
      "spiral/web.py",
      "spiral/builtin_scripts/quick_story/stories.json",
      "welcome-messages.txt",
    ]) expect(names).toContain(n);
    expect(names.some((n) => n.includes("__pycache__"))).toBe(false);
    expect(names.some((n) => n.includes("tests"))).toBe(false);
  });

  it("bundles community scripts as built-ins, skipping TEMPLATE, and refuses a clashing id", () => {
    const dir = tmp();
    mkdirSync(join(dir, "os/spiral/builtin_scripts/connect"), { recursive: true });
    writeFileSync(join(dir, "os/spiral/builtin_scripts/connect/script.py"), "");
    writeFileSync(join(dir, "os/welcome-messages.txt"), "hi\n");
    for (const id of ["birds", "TEMPLATE"]) {
      mkdirSync(join(dir, "scripts", id), { recursive: true });
      writeFileSync(join(dir, "scripts", id, "script.py"), "");
    }
    const names = Object.keys(unzipSync(buildOsZip(join(dir, "os"))));
    expect(names).toContain("spiral/builtin_scripts/birds/script.py");
    expect(names.some((n) => n.includes("TEMPLATE"))).toBe(false);
    mkdirSync(join(dir, "scripts/connect"));
    writeFileSync(join(dir, "scripts/connect/script.py"), "");
    expect(() => buildOsZip(join(dir, "os"))).toThrow(/built-in/);
  });

  it("is deterministic", () => {
    expect(Buffer.from(buildOsZip(osDir)).equals(Buffer.from(buildOsZip(osDir)))).toBe(true);
  });

  it("prepare() writes the zip and copies pyodide files into public/", () => {
    const out = tmp();
    prepare({ siteDir: site, osDir, publicDir: out });
    expect(existsSync(join(out, "spiral-os.zip"))).toBe(true);
    expect(existsSync(join(out, "pyodide", "pyodide-lock.json"))).toBe(true);
    expect(existsSync(join(out, "pyodide", "pyodide.asm.wasm"))).toBe(true);
    expect(readdirSync(join(out, "pyodide")).some((f) => f.endsWith(".whl"))).toBe(true);
  });

  it("fails on a corrupted wheel copy", () => {
    const dir = tmp();
    const vendor = join(site, "vendor/pyodide");
    mkdirSync(join(dir, "w"));
    for (const f of readdirSync(vendor)) copyFileSync(join(vendor, f), join(dir, "w", f));
    const lock = join(site, "node_modules/pyodide/pyodide-lock.json");
    expect(() => verifyWheels(join(dir, "w"), lock)).not.toThrow();
    const wheel = readdirSync(join(dir, "w")).find((f) => f.endsWith(".whl"))!;
    const bytes = readFileSync(join(dir, "w", wheel));
    bytes[100] ^= 0xff;
    writeFileSync(join(dir, "w", wheel), bytes);
    expect(() => verifyWheels(join(dir, "w"), lock)).toThrow(/sha256/);
  });
});

describe("committed public/spiral-os.zip (fallback when Vercel uploads only this folder)", () => {
  it("is byte-identical to a fresh build of ../os (run `npm run build` and commit it if this fails)", () => {
    const siteDir = resolve(__dirname, "../..");
    const committed = readFileSync(join(siteDir, "public/spiral-os.zip"));
    expect(Buffer.from(buildOsZip(resolve(siteDir, "../os"))).equals(committed)).toBe(true);
  });
});
