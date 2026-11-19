export type TodayEvent = { id: string; text: string; topic: string; source: string };
export type TodayFacts = {
  facts: { id: string; text: string; source: string }[];
  questions: { id: string; text: string }[];
};

/** Same pick for everyone on the same date: FNV-1a 32-bit hash of "YYYY-MM-DD", modulo n. */
export function pickForDate(date: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619) >>> 0;
  return h % n;
}

/** Event topics ("MM-DD") shown on a date; Feb 29 events show on Feb 28 in non-leap years, like the device script. */
export function otdTopics(date: string): string[] {
  const year = Number(date.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return date.slice(5) === "02-28" && !leap ? ["02-28", "02-29"] : [date.slice(5)];
}

/** The visitor's local date as "YYYY-MM-DD". */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
