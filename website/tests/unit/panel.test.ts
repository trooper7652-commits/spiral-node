import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BLINK_GAP_MS, BLINK_MS, shouldBlink } from "../../lib/panel";

const css = readFileSync(resolve(__dirname, "../../components/Panel.module.css"), "utf8");
const globals = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("panel blink", () => {
  it("blinks when the key changes, never on the first render or an unchanged key", () => {
    expect(shouldBlink(1, 2)).toBe(true);
    expect(shouldBlink("s1", "s2")).toBe(true);
    expect(shouldBlink(undefined, 1)).toBe(false);
    expect(shouldBlink(2, 2)).toBe(false);
    expect(shouldBlink(1, undefined)).toBe(false);
  });
  it("key 0 means the panel is not on screen: becoming live (0 to a key) blinks, going dark does not", () => {
    expect(shouldBlink(0, 1)).toBe(true);
    expect(shouldBlink(0, "6:r2")).toBe(true);
    expect(shouldBlink(1, 0)).toBe(false);
    expect(shouldBlink(0, 0)).toBe(false);
  });
  it("ignores a change within a second of the last blink, so a fast scroll makes at most 3 flashes a second", () => {
    expect(shouldBlink(1, 2, 999)).toBe(false);
    expect(shouldBlink(1, 2, 1000)).toBe(true);
    expect(shouldBlink(1, 2)).toBe(true);
    expect(BLINK_GAP_MS).toBe(1000);
  });
  it("is a 450 ms animation with two inversions", () => {
    expect(BLINK_MS).toBe(450);
    expect(css).toMatch(/\.blink\s*\{\s*animation:\s*eink 0\.45s/);
    expect((css.match(/invert\(1\) hue-rotate\(180deg\)/g) ?? []).length).toBe(2);
  });
  it("one global reduced-motion rule switches every animation off", () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after\s*\{\s*animation: none !important;/);
  });
});
