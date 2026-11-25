import { otdTopics, pickForDate, type TodayEvent, type TodayFacts } from "./today";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** RSS 2.0 feed of the last `days` dates (UTC, newest first): each item is that date's fact plus its first On This Day event. */
export function buildFeed(months: Record<string, TodayEvent[]>, facts: TodayFacts, siteUrl: string, buildDate: Date, days = 30): string {
  const link = `${siteUrl}/today`;
  const items: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(buildDate.getUTCFullYear(), buildDate.getUTCMonth(), buildDate.getUTCDate() - i));
    const date = day.toISOString().slice(0, 10);
    const topics = otdTopics(date);
    const event = (months[date.slice(5, 7)] ?? []).find((e) => topics.includes(e.topic));
    const fact = facts.facts[pickForDate(date, facts.facts.length)].text;
    const description = event ? `${fact} On this day: ${event.text}` : fact;
    items.push(
      `<item><title>${esc(`${MONTHS[day.getUTCMonth()]} ${day.getUTCDate()}, ${day.getUTCFullYear()}`)}</title><link>${esc(link)}</link>` +
        `<guid isPermaLink="false">today-${date}</guid><pubDate>${day.toUTCString()}</pubDate><description>${esc(description)}</description></item>`,
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Spiral Node: Today</title><link>${esc(link)}</link>` +
    `<description>${esc("A fact and a moment from history for each recent day.")}</description>` +
    `<lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>\n${items.join("\n")}\n</channel></rss>\n`
  );
}
