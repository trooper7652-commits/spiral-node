import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listScripts } from "../../lib/scripts";
import { scriptSamples } from "../../lib/scriptSamples";

const FILES: Record<string, string> = { fun_fact_question: "facts.json", daily_puzzle: "puzzles.json", big_questions: "questions.json" };

describe("scriptSamples", () => {
  const samples = scriptSamples();
  it("has the three scripts, in order", () => {
    expect(samples.map((s) => s.id)).toEqual(["fun_fact_question", "daily_puzzle", "big_questions"]);
  });
  it("takes each title from the script's name and links to its page", () => {
    const scripts = listScripts();
    for (const s of samples) {
      expect(scripts.find((x) => x.id === s.id)?.name).toBe(s.title);
      expect(s.href).toBe(`/scripts/${s.id}`);
    }
  });
  it("each sample is text from the script's own content file", () => {
    for (const s of samples) {
      expect(s.sample.length).toBeGreaterThan(0);
      const raw = readFileSync(join(process.cwd(), "../os/spiral/builtin_scripts", s.id, FILES[s.id]), "utf8");
      expect(JSON.parse(raw).some((e: { text: string }) => e.text === s.sample)).toBe(true);
    }
  });
});
