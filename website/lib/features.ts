export type Feature = { id: string; title: string; line: string; detail: string };

/** The home page's feature grid. Each id has a 16x16 icon at /art/icon-<id>.png, drawn by art/make_art.py. */
export const FEATURES: Feature[] = [
  {
    id: "offline",
    title: "Offline",
    line: "No internet, ever.",
    detail: "No Wi-Fi setup, no account and no feed. Facts, stories and topics live on the device, and nothing you do leaves it.",
  },
  {
    id: "eink",
    title: "E-ink",
    line: "A calm, paper-like screen.",
    detail: "A 2.13 inch, 250x122 black-and-white e-paper display with no backlight. It reads like a printed card and keeps its page without power.",
  },
  {
    id: "scripts",
    title: "Scripts",
    line: "Small loops that show something to think about.",
    detail: "A script is one Python file and its library. Fun Fact + Question, Quick Story and Connect come built in, and anyone can write a new one.",
  },
  {
    id: "connect",
    title: "Connect",
    line: "Two random topics. You find the link.",
    detail: "Every 15, 30 or 60 seconds, Connect shows two topics from different categories and asks: What links these? It never explains. The connection is yours to make.",
  },
  {
    id: "norepeats",
    title: "No repeats",
    line: "Nothing shows twice.",
    detail: "Every entry shown is logged, and shown entries are left out of the next pick. When a library runs out, Spiral Node asks if you want to start over.",
  },
  {
    id: "sourced",
    title: "Sourced facts",
    line: "Every fact keeps its source.",
    detail: "Each fact carries a link to where it came from, so you can check it or read more.",
  },
  {
    id: "wheel",
    title: "Spiral wheel",
    line: "One wheel, five moves.",
    detail: "Up, down, left, right and a centre press, all on one spiral-grooved wheel. A separate Back button (and Home) sits beside it; holding the centre also goes back.",
  },
  {
    id: "opensource",
    title: "Open source",
    line: "Code, hardware notes and scripts are open.",
    detail: "The code is GPL-3.0, the hardware notes CERN-OHL-S-2.0, and the docs and script content CC BY-SA 4.0. Read it, change it, and share your scripts.",
  },
];
