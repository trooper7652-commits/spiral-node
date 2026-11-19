import localFont from "next/font/local";


export const display = localFont({
  src: [
    { path: "../node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const body = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
