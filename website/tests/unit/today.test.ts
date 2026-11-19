import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { buildToday } from "../../scripts/prepare-assets.mjs";
import { localDate, otdTopics, pickForDate } from "../../lib/today";

const site = resolve(__dirname, "../..");
const osDir = resolve(site, "../os");

describe("today", () => {
  it("same date gives the same index", () => {
    const a = pickForDate("2026-07-04", 120);
    expect(pickForDate("2026-07-04", 120)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(120);
  });

  it("different dates differ for at least 360 of 366 days", () => {
    let differ = 0;
    for (let i = 1; i < 367; i++) {
      const cur = pickForDate(localDate(new Date(2028, 0, 1 + i)), 120);
      const prev = pickForDate(localDate(new Date(2028, 0, i)), 120);
      if (cur !== prev) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(360);
  });

  it("Feb 29 entries show on Feb 28 in non-leap years", () => {
    expect(otdTopics("2026-02-28")).toEqual(["02-28", "02-29"]);
    expect(otdTopics("2028-02-28")).toEqual(["02-28"]);
    expect(otdTopics("2028-02-29")).toEqual(["02-29"]);
  });

  it("buildToday", () => {
    const { months, facts } = buildToday(osDir);
    expect(Object.keys(months)).toHaveLength(12);
    for (const [m, events] of Object.entries<any[]>(months)) for (const e of events) expect(e.topic.startsWith(m)).toBe(true);
    expect(facts.facts.length).toBeGreaterThan(0);
    expect(facts.questions.length).toBeGreaterThan(0);
    for (const f of facts.facts) {
      expect(f.source).toMatch(/^https:\/\//);
      expect("check" in f).toBe(false);
    }
  });

  it("committed today files match the OS source", () => {
    const { months, facts } = buildToday(osDir);
    const read = (f: string) => JSON.parse(readFileSync(join(site, "public/today", f), "utf8"));
    for (const m of Object.keys(months)) expect(read(`otd-${m}.json`)).toEqual(months[m]);
    expect(read("facts.json")).toEqual(facts);
  });
});
