import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CREDITS } from "../../lib/credits";

describe("credits", () => {
  it("every entry is complete with an https link", () => {
    for (const c of CREDITS) {
      for (const v of Object.values(c)) expect(String(v).trim()).not.toBe("");
      expect(c.url).toMatch(/^https:\/\//);
    }
  });

  it("the page says the figures are drawn from imagination", () => {
    expect(readFileSync(resolve(__dirname, "../../app/credits/page.tsx"), "utf8")).toContain("The people in the scenes are historical figures, drawn from imagination.");
  });

  it("lists VT323 under the SIL Open Font License and no museum artwork", () => {
    const vt = CREDITS.filter((c) => c.title === "VT323");
    expect(vt).toHaveLength(1);
    expect(vt[0].licence).toMatch(/SIL Open Font License/);
    for (const c of CREDITS) expect(c.licence).not.toMatch(/public domain|CC0/i);
    expect(CREDITS.length).toBe(1);
  });
});
