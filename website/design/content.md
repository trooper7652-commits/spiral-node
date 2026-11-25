# Copy deck

Every sentence is traced to the product notes (K: section) or the website brief (S). Prototype-status items are labelled. The site states no prices, dates, battery figures or invented specs.

## Global

- Site title: "Spiral Node by Helix Velocities" (K: Company)
- Header nav: Product, Scripts, Today, Community, Devlog, Build log, ★ GitHub, **Try the demo** (the live list is `lib/nav.ts`). Company is in the footer. (S: Pages)
- Footer: an inline email sign-up ("Get Spiral Node updates"), GitHub, Discussions, Press, Licences, Credits, Company; "Spiral Node is a prototype by Helix Velocities." / "The logo is a placeholder for now." (S: Constraints)

## `/` Product

The home page is a story told by scrolling, in nine scenes (`components/story/sections`). The live copy is in `lib/content.ts` and the components. "How it works", "The maker community" and "Prototype hardware" below were folded into the scenes; they stay here as the source lines.

### Scene 1
- H1: "Spiral Node" — sub: "A pocket-size e-ink device that hands you keys to new thinking." (K: What Spiral Node is: "helps the user think of new ideas, get inspiration, and open 'keys to new thinking'")
- Button: **Try the demo** → `/try`. (S: Hero 6)

### How it works (S: Rest of the site)
- **Scripts.** "Spiral Node runs Scripts: small loops that show something to think about. One built-in script shows one fun fact and one question every 15, 30 or 60 seconds. Quick Story tells short stories, page by page." (K: What; Interface)
- **Fully offline.** "No internet, ever. Everything lives on the device." (K: What: "Fully offline and self-sustained")
- **Sourced facts.** "Every fact links to where it came from."
- **No repeats.** "Every fact and question shown is logged, and the code removes shown entries before picking, so nothing repeats. When a library runs out, Spiral Node asks if you want to start over." (K: Fact library)

### The maker community — label *Coming*
- "For visionaries, artisans, crafters, makers, doers, designers, innovators and operators who love thinking." (K: tagline; S)
- "Scripts are plain Python, so they can be open-sourced and shared." (K: What; Software) — "The community doesn't exist yet."

### Prototype hardware — label *Prototype parts, being tested*
- Orange Pi Zero 2W (1.5 GB) · 2.13 inch e-paper display, 250x122, black and white · PiSugar 3 power board · five buttons (up, down, left, right, select). (K: Prototype hardware)
- "Battery life: all day is the goal; it hasn't been measured yet." (K: Industrial design; S Constraints)

### Roadmap (K: Development order)
1. Spiral OS on a simulator — *you can try it now*.
2. Spiral OS on a Raspberry Pi 5.
3. Spiral OS on the Orange Pi prototype.

## `/try`
- H1: "Try Spiral Node"
- Intro: "This is the real Spiral OS, running in your browser. It saves to this browser only."
- Power button: "Power on"
- Guide "How to use": "Up, down, left, right: the edges of the wheel (or arrow keys). Select: the centre (Enter or Space). Back: the Back button (or Backspace, Esc); holding select for 0.6 s also goes Back. Home: the Home button (or H) jumps to Home from anywhere. On Home, right shows the next entry and left the previous one. On a question, left and right pick an answer, select answers and down skips. Scripts are small programs; pick one, set its refresh time, press OK." (K: Interface and menu)
- Tools: "Reset device" (confirm: "Erase this simulated device's saved state?"), "Realistic e-ink" on/off.
- Errors: "This browser can't run the simulator (it needs WebAssembly and IndexedDB)." / "Download failed." / "Spiral OS hit an error." + **Try again**.

## `/company`
- H1: "Helix Velocities"
- "Helix Velocities ('Helix') makes Spiral Node, its first product." (K: Company)
- Tagline: "A key to ingenuity for visionaries, artisans, crafters, makers, doers, designers, innovators, operators". (K)
- "Our mascot is a snail: its spiral shell is the theme of Spiral Node, right down to the spiral boot animation." (K)
- Core values: **Creativity** and **Inventiveness**. (K)
