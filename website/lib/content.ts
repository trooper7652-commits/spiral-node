/** Home page FAQ and roadmap. Facts stay honest: prototype in progress, battery not measured. */
export const FAQ: { q: string; a: string }[] = [
  { q: "How long does the battery last?", a: "We haven't measured it yet. All day is the goal, and we'll share real numbers once the prototype runs on its battery." },
  { q: "Is it private?", a: "Yes. Spiral Node is fully offline: no account, no cloud and no tracking. Nothing leaves the device." },
  { q: "Why no internet?", a: "So it never turns into another feed. Spiral Node hands you something to think about, then leaves the thinking to you." },
  { q: "Why not just a phone app?", a: "Your phone is great at a hundred things, which is why it pulls you away. Spiral Node does one: it shows you something to think about. No notifications, no feed." },
  { q: "Isn't e-ink slow and black-and-white?", a: "On purpose. It changes every 15, 30 or 60 seconds, reads well in sunlight, is easy on the eyes, holds its picture without using power, and doesn't glow at night." },
  { q: "Why not a Kindle?", a: "A Kindle is wonderful for long reading you choose. Spiral Node hands you short ideas and questions you didn't know to look for." },
  { q: "How much does it cost?", a: "It isn't for sale yet. The hardware is a prototype in progress. Sign up for updates to hear when that changes." },
  { q: "Can I build my own?", a: "Yes. The code and hardware notes are open source, and the simulator runs the real Spiral OS today. The parts list and form factor are in the repo's hardware folder." },
  { q: "What if Helix Velocities disappears?", a: "It keeps working. It's open source and fully offline, with no servers to shut down, and anyone can rebuild it." },
  { q: "Can I use it in class?", a: "It has no internet, games or messaging, so it's easy for a teacher to say yes." },
  { q: "Do I need to code?", a: "You never have to. Pick a built-in script like Chess Puzzles, Poems or On This Day, or one from the community gallery." },
  { q: "Where do the facts come from?", a: "Every fact comes with a link to its source, so you can check it or read more." },
];

export const ROADMAP: { text: string; done: boolean; href?: string }[] = [
  { text: "Spiral OS in a browser simulator", done: true, href: "/try" },
  { text: "Connect, the two-topic script", done: true, href: "/try?script=connect" },
  { text: "Open source: code, hardware notes and licences", done: true },
  { text: "Spiral OS on a Raspberry Pi 5", done: false },
  { text: "Spiral OS on the Orange Pi prototype", done: false },
  { text: "Community scripts in the gallery", done: false },
];
