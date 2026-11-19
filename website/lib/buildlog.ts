import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markdown } from "./devlog";

export type BuildLogEntry = { slug: string; date: string; title: string; photos: string[]; html: string };

// read at build time; the site builds from website/
const DIR = join(process.cwd(), "content/build-log");

/** One entry: front matter (date, title, photos as a comma list) between --- lines, then Markdown. */
export function parse(src: string): Omit<BuildLogEntry, "slug"> {
  const m = src.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("build-log: missing front matter");
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const k of ["title", "date"]) if (!meta[k]) throw new Error(`build-log: missing ${k}`);
  const photos = (meta.photos ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return { date: meta.date, title: meta.title, photos, html: markdown(m[2]) };
}

/** Every entry in content/build-log, newest first. Empty until the first photos are added. */
export function listEntries(): BuildLogEntry[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), ...parse(readFileSync(join(DIR, f), "utf8")) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
