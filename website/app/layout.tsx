import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { body, display } from "./fonts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignupPopup from "@/components/SignupPopup";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.siteUrl),
  title: "Spiral Node by Helix Velocities",
  robots: { index: SITE.indexable, follow: SITE.indexable },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
        <SignupPopup />
        {/* Vercel builds only; locally /_vercel/insights would 404 */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
