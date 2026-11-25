/** The eight historical figures, one per scene. The strings are public facts: change them only against a source. */
export const FIGURES: { id: string; name: string; years: string; scene: string }[] = [
  { id: "newton", name: "Isaac Newton", years: "1643–1727", scene: "s1" },
  { id: "leonardo", name: "Leonardo da Vinci", years: "1452–1519", scene: "s2" },
  { id: "anning", name: "Mary Anning", years: "1799–1847", scene: "s3" },
  { id: "faraday", name: "Michael Faraday", years: "1791–1867", scene: "s4" },
  { id: "lovelace", name: "Ada Lovelace", years: "1815–1852", scene: "s5" },
  { id: "idrisi", name: "Al-Idrisi", years: "about 1100–1165", scene: "s6" },
  { id: "galileo", name: "Galileo Galilei", years: "1564–1642", scene: "s7" },
  { id: "socrates", name: "Socrates", years: "about 470–399 BC", scene: "s8" },
];

/** "<name>, <years>" of the figure `id`. */
export function whoLabel(id: string): string {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) throw new Error(`no figure ${id}`);
  return `${f.name}, ${f.years}`;
}
