import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGURES, whoLabel } from "../../lib/figures";

const world = resolve(__dirname, "../../public/world");
const SCENE_DIR: Record<string, string> = { s1: "countryside-sunset", s2: "desk", s3: "shell", s4: "device", s5: "scroll", s6: "map", s7: "atlas", s8: "square", s9: "hill" };
const whoIds = (dir: string, v: string): string[] =>
  JSON.parse(readFileSync(resolve(world, dir, v, "manifest.json"), "utf8")).tags.map((t: { id: string }) => t.id).filter((id: string) => id.startsWith("who"));

describe("figures", () => {
  it("have exactly the names and years of the plan", () => {
    expect(FIGURES.map((f) => whoLabel(f.id))).toEqual([
      "Isaac Newton, 1643–1727",
      "Leonardo da Vinci, 1452–1519",
      "Mary Anning, 1799–1847",
      "Michael Faraday, 1791–1867",
      "Ada Lovelace, 1815–1852",
      "Al-Idrisi, about 1100–1165",
      "Galileo Galilei, 1564–1642",
      "Socrates, about 470–399 BC",
    ]);
  });

  it("every manifest's who tag maps to a figure of that scene", () => {
    expect(readdirSync(world).length).toBeGreaterThan(0);
    for (const v of ["wide", "tall"]) {
      for (const f of FIGURES) expect(whoIds(SCENE_DIR[f.scene], v), `${f.scene} ${v}`).toEqual(["who"]);
      expect(whoIds(SCENE_DIR.s9, v), `s9 ${v}`).toEqual(FIGURES.map((f) => `who-${f.id}`));
    }
  });
});
