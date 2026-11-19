import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];

// WCAG 2.x relative luminance and contrast ratio
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

describe("colour contrast (WCAG AA 4.5:1)", () => {
  it("the formula gives 21 for black on white", () => expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5));
  it("ink text on orange", () => expect(ratio(token("ink"), token("orange"))).toBeGreaterThanOrEqual(4.5));
  it("paper text on brown", () => expect(ratio(token("paper"), token("brown"))).toBeGreaterThanOrEqual(4.5));
  it("paper header text on olive-deep", () => expect(ratio(token("paper"), token("olive-deep"))).toBeGreaterThanOrEqual(4.5));
  it("ink text on copper", () => expect(ratio(token("ink"), token("copper"))).toBeGreaterThanOrEqual(4.5));
  it("paper text on copper-deep", () => expect(ratio(token("paper"), token("copper-deep"))).toBeGreaterThanOrEqual(4.5));
  it("olive-deep links on paper", () => expect(ratio(token("olive-deep"), token("paper"))).toBeGreaterThanOrEqual(4.5));
});
