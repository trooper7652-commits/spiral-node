import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const site = resolve(__dirname, "../..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

it("public wording: no 'Inc.', 'multi-tool', 'Tamagotchi' or 'for hackers' in app/, components/, lib/", () => {
  const banned = /\bInc\.|multi-tool|tamagotchi|for hackers/i;
  const hits = ["app", "components", "lib"]
    .flatMap((d) => files(join(site, d)))
    .filter((f) => banned.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});

it("no place puts the USB-C, the charge light or the power button on the side", () => {
  const side = /USB-C side|device-side|left side|side face|(charge light|power button)[^.\n]{0,40}\bside\b/i;
  const hits = ["app", "components", "lib", "design"]
    .flatMap((d) => files(join(site, d)))
    .filter((f) => /\.(tsx?|md|css)$/.test(f) && side.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});

it("the site font is VT323 only", () => {
  const fonts = readFileSync(join(site, "app/fonts.ts"), "utf8");
  expect(fonts).toContain("@fontsource/vt323");
  expect(fonts).not.toMatch(/manrope|departure|pixelify|ibm-plex|atkinson/i);
});
