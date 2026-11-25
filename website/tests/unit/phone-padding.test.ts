import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product page on a phone", () => {
  it("keeps the sticky bar clear of the home indicator when scrolling to an anchor", () => {
    const css = readFileSync("app/spiral-node/page.module.css", "utf8");
    expect(css).toContain("scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom))");
  });
});
