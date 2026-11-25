import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ } from "../../lib/content";
import { FEATURES } from "../../lib/features";
import * as product from "../../lib/product";
import { BENEFIT_IDS, DAY, DOESNT, HERO_BULLETS, HOW, PRODUCT_FAQ, PRODUCT_IMAGES, SPECS, STATUS, imageById } from "../../lib/product";
import { listScripts } from "../../lib/scripts";

describe("product content", () => {
  it("ids are unique and every alt and caption is filled", () => {
    const ids = PRODUCT_IMAGES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of PRODUCT_IMAGES) {
      expect(i.alt.trim()).not.toBe("");
      expect(i.caption.trim()).not.toBe("");
    }
  });
  it("every src is null or a file under public/product/", () => {
    for (const i of PRODUCT_IMAGES) {
      if (i.src === null) continue;
      expect(i.src.startsWith("/product/")).toBe(true);
      expect(existsSync(join("public", i.src))).toBe(true);
    }
  });
  it("each DAY script exists and has its screen picture", () => {
    const ids = listScripts().map((s) => s.id);
    for (const d of DAY) {
      expect(ids).toContain(d.script);
      expect(existsSync(join("public", "og", `script-${d.script}.png`))).toBe(true);
    }
  });
  it("imageById throws on an unknown id", () => {
    expect(() => imageById("nope")).toThrow(/no product image/);
  });
  it("no dates or prices in the product copy", () => {
    for (const t of [STATUS, ...HERO_BULLETS, ...HOW, ...DOESNT, ...SPECS.map((s) => s.value)]) {
      expect(t).not.toMatch(/\b20\d\d\b/);
      expect(t).not.toMatch(/[$€£]/);
    }
  });
  it("the ports are two USB-C on the top, and no page image is a drawing of a side face", () => {
    expect(SPECS.find((s) => s.label === "Port")!.value).toBe("Two USB-C, planned on the top");
    expect(PRODUCT_IMAGES.map((i) => i.id)).toEqual(["front", "in-hand", "sketch-front"]);
    expect(JSON.stringify(PRODUCT_IMAGES)).not.toMatch(/side/i);
  });
  it("no mojibake in any exported string", () => {
    const strings = JSON.stringify(Object.values(product));
    expect(strings).not.toMatch(/[ÃÂ]/);
  });
  it("every benefit id is a feature", () => {
    for (const id of BENEFIT_IDS) {
      expect(FEATURES.some((f) => f.id === id)).toBe(true);
    }
  });
  it("every product question is in the FAQ", () => {
    for (const q of PRODUCT_FAQ) expect(FAQ.some((f) => f.q === q)).toBe(true);
  });
});
