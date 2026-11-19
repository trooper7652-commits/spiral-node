import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Post = { slug: string; title: string; date: string; summary: string; html: string };

// read at build time; the site builds from website/
const DIR = join(process.cwd(), "content/devlog");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline Markdown on escaped text: `code`, **bold**, *em*, and [text](https://... or /path) links only (not //host). */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/))[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

/** The Markdown the devlog uses: "## " headings, "- " lists and paragraphs, separated by blank lines. */
export function markdown(src: string): string {
  return src
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n");
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (lines.every((l) => l.startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
      return `<p>${inline(lines.join(" "))}</p>`;
    })
    .join("\n");
}

/** One entry: front matter (title, date, summary) between --- lines, then Markdown. */
export function parse(slug: string, raw: string): Post {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`devlog ${slug}: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const k of ["title", "date", "summary"]) if (!meta[k]) throw new Error(`devlog ${slug}: missing ${k}`);
  return { slug, title: meta.title, date: meta.date, summary: meta.summary, html: markdown(m[2]) };
}

/** Every entry in content/devlog, newest first. */
export function listPosts(): Post[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parse(f.replace(/\.md$/, ""), readFileSync(join(DIR, f), "utf8")))
    .sort((a, b) => b.date.localeCompare(a.date));
}
