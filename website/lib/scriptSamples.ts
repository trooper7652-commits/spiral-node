import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listScripts } from "./scripts";

// the three scripts scene 5 shows, and the content file whose first entry is the sample (read at build time)
const PICKS = [
  ["fun_fact_question", "facts.json"],
  ["daily_puzzle", "puzzles.json"],
  ["big_questions", "questions.json"],
] as const;

export type ScriptSample = { id: string; title: string; sample: string; href: string };

export function scriptSamples(): ScriptSample[] {
  const all = listScripts();
  return PICKS.map(([id, file]) => {
    const [first] = JSON.parse(readFileSync(join(process.cwd(), "../os/spiral/builtin_scripts", id, file), "utf8")) as { text: string }[];
    return { id, title: all.find((s) => s.id === id)!.name, sample: first.text, href: `/scripts/${id}` };
  });
}
