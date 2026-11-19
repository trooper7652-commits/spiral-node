import type { Metadata } from "next";

/** Title, description and link-preview tags for one page. The 1200x630 images come from art/make_art.py (public/og/). */
export function og(image: string, title: string, description: string): Metadata {
  const images = [{ url: `/og/${image}.png`, width: 1200, height: 630 }];
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Spiral Node", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
