// Image budget for the home page, as the PNG bytes of each scene's art. The first screen is the font plus the shots the
// first frame loads (the one it shows and the next): with the opening on that is s0 and scene 1 (worst of both skies),
// without it scenes 1 and 2. Also the biggest single scene, and the whole story.
// usage: node scripts/check-budget.mjs  (exit 1 when over budget)
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const { homeWorld } = await import("../lib/world/home.ts");
const LIMITS = { first: 600e3, shot: 300e3, story: 12e6 };
const root = join(import.meta.dirname, "..");
const pub = join(root, "public");
const bytes = (url) => {
  const dir = join(pub, dirname(url));
  return readdirSync(dir).filter((f) => f.endsWith(".png")).reduce((n, f) => n + statSync(join(dir, f)).size, 0);
};
const art = (shot, v) => bytes(shot.art[v]);
const font = join(root, "node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2"); // app/fonts.ts
if (!existsSync(font)) throw new Error(`font file missing: ${font} (run npm ci, or update the path)`);
const fontBytes = statSync(font).size;

const worlds = ["sunset", "night"].map((sky) => homeWorld(sky, { opening: false }));
const opened = ["sunset", "night"].map((sky) => homeWorld(sky, { opening: true }));
// phones load the tall art, so the worse of the two variants counts
const firstScreen = (w) => Math.max(...["wide", "tall"].map((v) => fontBytes + art(w.shots[0], v) + art(w.shots[1], v)));

// each scene's art once, named by its folder (scene 1 has one per sky)
const seen = new Set();
for (const s of opened.flatMap((w) => w.shots)) {
  const name = s.art.wide.split("/")[2];
  if (seen.has(name)) continue;
  seen.add(name);
  console.log(`scene  ${name}: wide ${Math.round(art(s, "wide") / 1e3)} KB, tall ${Math.round(art(s, "tall") / 1e3)} KB`);
}

const got = {
  // the first screen of a first visit (the opening) and of any other (scenes 1 and 2): both must fit
  first: Math.max(...[...opened, ...worlds].map(firstScreen)),
  shot: Math.max(...opened.flatMap((w) => w.shots.flatMap((s) => [art(s, "wide"), art(s, "tall")]))),
  story: opened[0].shots.reduce((n, s) => n + art(s, "wide"), 0),
};

let ok = true;
for (const k of Object.keys(LIMITS)) {
  const pass = got[k] <= LIMITS[k];
  ok &&= pass;
  console.log(`${pass ? "ok  " : "OVER"} ${k}: ${Math.round(got[k] / 1e3)} KB of ${Math.round(LIMITS[k] / 1e3)} KB`);
}
process.exit(ok ? 0 : 1);
