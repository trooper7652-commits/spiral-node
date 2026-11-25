import { SITE } from "./site";

export type NavItem = { label: string; href: string; hook: string; ariaLabel?: string };

/** The header links in order; each hook is the one line its preview card shows. */
export const NAV: readonly NavItem[] = [
  { label: "Product", href: "/spiral-node", hook: "A pocket device that hands you one thing to think about." },
  { label: "Scripts", href: "/scripts", hook: "Facts, chess puzzles, poems and big questions. Try one." },
  { label: "Today", href: "/today", hook: "A fact, a question and a moment from history. New every day." },
  { label: "Community", href: "/#community", hook: "Write a script and share it with other thinkers." },
  { label: "Devlog", href: "/devlog", hook: "What changed in Spiral Node, and why." },
  { label: "Build log", href: "/build-log", hook: "Bench photos and notes as the prototype comes together." },
  { label: "\u2605 GitHub", href: SITE.repoUrl, hook: "Open source. A star helps other thinkers find it.", ariaLabel: "Star Spiral Node on GitHub" },
];
