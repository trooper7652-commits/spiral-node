/** Outside works the site uses (today only the font), each with its source and licence. */
export type Credit = {
  title: string;
  artist: string;
  year: string;
  /** the collection or archive that holds the work */
  source: string;
  url: string;
  licence: string;
  /** where the site shows it */
  where: string;
};

export const CREDITS: readonly Credit[] = [
  {
    title: "VT323",
    artist: "Peter Hull",
    year: "2011",
    source: "Google Fonts, self-hosted from the @fontsource/vt323 package",
    url: "https://fonts.google.com/specimen/VT323",
    licence: "SIL Open Font License 1.1",
    where: "every page",
  },
];
