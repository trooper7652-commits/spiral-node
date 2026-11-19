import type { NextConfig } from "next";

// Static export: Vercel rejects function names containing a space ("Spiral Node/"), and every page is static.
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true }, // export has no image optimizer
  experimental: { inlineCss: true }, // the CSS is small; inlining removes render-blocking requests on mobile
};

export default config;
