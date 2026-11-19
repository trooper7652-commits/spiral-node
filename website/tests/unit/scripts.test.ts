import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { constant, listScripts } from "../../lib/scripts";

describe("script gallery data", () => {
  it("lists connect, fun_fact_question and quick_story, each with a name, a description and an author", () => {
    const all = listScripts();
    for (const id of ["connect", "fun_fact_question", "quick_story"]) {
      const s = all.find((x) => x.id === id);
      expect(s, id).toBeDefined();
      expect(s!.name.length).toBeGreaterThan(0);
      expect(s!.description.length).toBeGreaterThan(10);
      expect(s!.author).toBe("Spiral Node");
    }
    expect(all.find((x) => x.id === "TEMPLATE")).toBeUndefined();
  });
  it("every listed script has an OG image file", () => {
    for (const s of listScripts()) expect(existsSync(resolve(__dirname, `../../public/og/script-${s.id}.png`)), s.id).toBe(true);
  });
  it("reads single- and double-quoted constants", () => {
    expect(constant('NAME = "Connect"\n', "NAME")).toBe("Connect");
    expect(constant("AUTHOR = 'ada'  # me\n", "AUTHOR")).toBe("ada");
    expect(constant("X = 1\n", "NAME")).toBeUndefined();
  });
});
