import { describe, expect, it } from "vitest";
import { buildFeed } from "../../lib/feed";
import type { TodayEvent, TodayFacts } from "../../lib/today";

const facts: TodayFacts = {
  facts: [{ id: "f1", text: "Honey never spoils.", source: "https://example.org/honey" }],
  questions: [{ id: "q1", text: "What would you ask a tree?" }],
};
const ev = (topic: string, text: string): TodayEvent => ({ id: `${topic}-1`, text, topic, source: "https://example.org" });
const months: Record<string, TodayEvent[]> = {
  "06": [ev("06-15", "AT&T <b> \"x\" it's")],
  "07": [ev("07-04", "A plain event.")],
};
const build = new Date("2026-07-10T23:30:00Z");
const feed = () => buildFeed(months, facts, "https://site.test", build);

describe("feed", () => {
  it("has 30 items, newest first, pubDates <= build date", () => {
    const xml = feed();
    expect(xml.match(/<item>/g)).toHaveLength(30);
    const titles = [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    expect(titles[0]).toBe("July 10, 2026");
    expect(titles[29]).toBe("June 11, 2026");
    const pubs = [...xml.matchAll(/<pubDate>([^<]*)<\/pubDate>/g)].map((m) => m[1]);
    expect(pubs).toHaveLength(30);
    for (const p of pubs) {
      expect(p).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
      expect(Date.parse(p)).toBeLessThanOrEqual(build.getTime());
    }
    expect(xml).toContain('<guid isPermaLink="false">today-2026-07-10</guid>');
    expect(xml).toContain("<link>https://site.test/today</link>");
  });

  it("joins the fact and the first event, or gives the fact alone", () => {
    const xml = feed();
    expect(xml).toContain("Honey never spoils. On this day: A plain event.");
    expect(xml).toMatch(/<description>Honey never spoils\.<\/description>/);
  });

  it("special characters are escaped", () => {
    const xml = feed();
    expect(xml).toContain("AT&amp;T &lt;b&gt; &quot;x&quot; it&#39;s");
    expect(xml).not.toContain("<b>");
    expect(xml).not.toContain("AT&T");
  });
});
