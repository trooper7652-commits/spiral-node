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

it("public copy never mentions AI", () => {
  const banned = /\bAI\b|artificial intelligence/i;
  const dirs = ["app", "components", "lib", "content"].map((d) => join(site, d));
  const hits = [...dirs.flatMap((d) => files(d)), resolve(site, "../README.md")]
    .filter((f) => /\.(tsx?|md|css)$/.test(f))
    .filter((f) => banned.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});

it("body font is IBM Plex Mono, not Atkinson", () => {
  const fonts = readFileSync(join(site, "app/fonts.ts"), "utf8");
  expect(fonts).toContain("@fontsource/ibm-plex-mono");
  expect(fonts).not.toMatch(/atkinson/i);
});
