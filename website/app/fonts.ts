import localFont from "next/font/local";

// One family (VT323, a single 400 weight); globals.css maps --font-display, --font-body and --font-label onto it.
export const sans = localFont({
  src: [{ path: "../node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2", weight: "400", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
  fallback: ["VT323", "ui-monospace", "monospace"],
});
