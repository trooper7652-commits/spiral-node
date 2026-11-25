import { readFileSync } from "node:fs";
import path from "node:path";
import { buildFeed } from "@/lib/feed";
import { SITE } from "@/lib/site";
import type { TodayEvent, TodayFacts } from "@/lib/today";

export const dynamic = "force-static";

export function GET() {
  const dir = path.join(process.cwd(), "public", "today");
  const read = <T>(name: string): T => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
  const months: Record<string, TodayEvent[]> = {};
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    months[mm] = read<TodayEvent[]>(`otd-${mm}.json`);
  }
  return new Response(buildFeed(months, read<TodayFacts>("facts.json"), SITE.siteUrl, new Date()), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
