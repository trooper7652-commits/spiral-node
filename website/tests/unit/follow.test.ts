import { describe, expect, it } from "vitest";
import { channels } from "../../lib/follow";

const none = { youtube: "", tiktok: "", instagram: "", bluesky: "", x: "" };

describe("channels", () => {
  it("is empty when every handle is empty", () => expect(channels(none)).toEqual([]));
  it("returns one channel for one handle", () => {
    const c = channels({ ...none, youtube: "https://youtube.com/@spiralnode" });
    expect(c).toHaveLength(1);
    expect(c[0].name).toBe("YouTube");
    expect(c[0].url).toBe("https://youtube.com/@spiralnode");
  });
  it("keeps the order youtube, tiktok", () => {
    const c = channels({ ...none, tiktok: "https://tiktok.com/@s", youtube: "https://youtube.com/@s" });
    expect(c.map((x) => x.key)).toEqual(["youtube", "tiktok"]);
  });
  it("throws for a handle that is not an https URL", () => {
    expect(() => channels({ ...none, tiktok: "tiktok.com/@spiralnode" })).toThrow(/must start with https/);
  });
  it("returns all five in order with their lines", () => {
    const all = { youtube: "https://a.example/y", tiktok: "https://a.example/t", instagram: "https://a.example/i", bluesky: "https://a.example/b", x: "https://a.example/x" };
    const c = channels(all);
    expect(c.map((x) => x.key)).toEqual(["youtube", "tiktok", "instagram", "bluesky", "x"]);
    expect(c.map((x) => x.name)).toEqual(["YouTube", "TikTok", "Instagram", "Bluesky", "X"]);
    expect(c.map((x) => x.what)).toEqual([
      "Short videos, and longer build videos.",
      "Short videos: something to think about, and the build.",
      "Reels from the build and the pixel-art scenes.",
      "Build notes and a question to think about.",
      "Build notes and a question to think about.",
    ]);
  });
  it("SITE.social is valid", () => {
    expect(() => channels()).not.toThrow();
  });
});
