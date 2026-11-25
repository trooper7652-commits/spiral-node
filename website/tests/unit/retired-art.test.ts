import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pictures from earlier looks; no page, component or module may use them again.
const RETIRED = ["/art/explore-", "/art/icon-", "/art/scene", "/art/animal-", "/art/birds", "/art/cloud-", "/art/stars", "/art/hero-screen", "/art/hero-wheel", "/story/", "-plate-", "world-lab/map-lr.png", "world-lab/cloud.png", "world-lab/"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css|mjs)$/.test(name) ? [p] : [];
  });
}

describe("retired pixel art", () => {
  it("no page, component or module refers to a retired picture", () => {
    const hits = ["app", "components", "lib", "scripts"].flatMap(files).flatMap((f) => {
      // import lines name source folders (components/story/...), not picture URLs
      const text = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(import|export)\b.*from\s/.test(l)).join("\n");
      return RETIRED.filter((r) => text.includes(r)).map((r) => `${f}: ${r}`);
    });
    expect(hits).toEqual([]);
  });
});