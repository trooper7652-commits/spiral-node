import { SITE } from "./site";

export type SocialKey = "youtube" | "tiktok" | "instagram" | "bluesky" | "x";
export type Channel = { key: SocialKey; name: string; what: string; url: string };

const INFO: Record<SocialKey, { name: string; what: string }> = {
  youtube: { name: "YouTube", what: "Short videos, and longer build videos." },
  tiktok: { name: "TikTok", what: "Short videos: something to think about, and the build." },
  instagram: { name: "Instagram", what: "Reels from the build and the pixel-art scenes." },
  bluesky: { name: "Bluesky", what: "Build notes and a question to think about." },
  x: { name: "X", what: "Build notes and a question to think about." },
};

/** The channels with a handle set, in a fixed order. A non-https value fails the build. */
export function channels(social: Record<SocialKey, string> = SITE.social): Channel[] {
  return (Object.keys(INFO) as SocialKey[]).flatMap((key) => {
    const url = social[key];
    if (!url) return [];
    if (!url.startsWith("https://")) throw new Error(`social.${key} must start with https://`);
    return [{ key, ...INFO[key], url }];
  });
}
