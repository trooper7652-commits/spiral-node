import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// two rules for one class, or two @keyframes with one name, silently merge in a CSS module
const css = readFileSync(join(process.cwd(), "components/hero/HeroScenes.module.css"), "utf8");
const dupes = (names: string[]) => names.filter((n, i) => names.indexOf(n) !== i);

describe("HeroScenes.module.css", () => {
  it("defines no keyframes name twice", () => {
    expect(dupes([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]))).toEqual([]);
  });
  it("starts no top-level single-class rule twice", () => {
    expect(dupes([...css.matchAll(/^\.([\w-]+)\s*\{/gm)].map((m) => m[1]))).toEqual([]);
  });
});
