export type ProductImage = { id: string; kind: "photo" | "sketch"; alt: string; caption: string; src: string | null };

// src stays null until a real file exists: run prep_photos.py into public/product/, then set src to "/product/<file>"
// landscape photos only (prep_photos.py makes portrait 3:4 for tall inputs)
export const PRODUCT_IMAGES: readonly ProductImage[] = [
  { id: "front", kind: "photo", alt: "The Spiral Node prototype, from the front", caption: "The prototype", src: null },
  { id: "in-hand", kind: "photo", alt: "The prototype held in one hand", caption: "In the hand", src: null },
  { id: "sketch-front", kind: "sketch", alt: "Pencil sketch of the pager layout: screen on top, spiral wheel and two keys below", caption: "The pager layout", src: null },
];

export function imageById(id: string): ProductImage {
  const found = PRODUCT_IMAGES.find((i) => i.id === id);
  if (!found) throw new Error(`no product image "${id}"`);
  return found;
}

export const DAY: readonly { time: "Morning" | "Afternoon" | "Evening"; script: string; line: string }[] = [
  { time: "Morning", script: "fun_fact_question", line: "A fact, and a question to go with it." },
  { time: "Afternoon", script: "chess_puzzles", line: "A chess puzzle that plays out move by move." },
  { time: "Evening", script: "poems", line: "A short public-domain poem." },
];

export const SPECS: readonly { label: string; value: string }[] = [
  { label: "Screen", value: "2.13 inch e-paper, 250 × 122, black and white" },
  { label: "Buttons", value: "Five on the prototype: up, down, left, right and select. The planned pager has a spiral wheel, Back and Home." },
  { label: "Board", value: "Orange Pi Zero 2W (1.5 GB), prototype" },
  { label: "Power", value: "PiSugar 3 power board and a 1,800 mAh flat battery. Battery life hasn't been measured yet; all day is the goal." },
  { label: "Port", value: "Two USB-C, planned on the top" },
  { label: "Internet", value: "None. No account, no cloud, no tracking." },
  { label: "Licences", value: "Software GPL-3.0, hardware CERN-OHL-S-2.0, text CC BY-SA 4.0" },
];

export const DOESNT: readonly string[] = ["No apps to install", "No feed to scroll", "No notifications", "No account", "No internet connection"];

export const STATUS = "Prototype · not for sale yet";

export const HERO_BULLETS: readonly string[] = [
  "One idea at a time: a fact, a puzzle, a poem or a question.",
  "Offline: no account, no feed, no notifications.",
  "Open source: write your own scripts and share them.",
];

export const BENEFIT_IDS: readonly string[] = ["offline", "eink", "sourced", "norepeats"];

export const HOW: readonly string[] = [
  "Pick a script: facts, chess, poems, big questions, or one you wrote.",
  "It shows one thing at a time on a calm e-ink screen, every 15, 30 or 60 seconds.",
  "You do the thinking. No feed, nothing to scroll.",
];

export const PRODUCT_FAQ: readonly string[] = [
  "How much does it cost?",
  "How long does the battery last?",
  "Is it private?",
  "Isn't e-ink slow and black-and-white?",
  "Can I build my own?",
  "Do I need to code?",
];
