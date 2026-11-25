/** The opening is a scene in front of scene 1 (see lib/world/home.ts). The key holds "1" once a visitor has been through it. */
export const OPENED_KEY = "sn-opened";

export type OpeningMode = "first" | "always" | "off";

/** Whether the page starts with the opening: never for "off", reduced motion or a start anywhere but the top (a link to a section, a restored scroll); "always" plays it every time, "first" only until it has been seen. */
export function shouldOpen(mode: OpeningMode, seen: boolean, startsAtTop: boolean, reducedMotion: boolean): boolean {
  if (mode === "off" || reducedMotion || !startsAtTop) return false;
  return mode === "always" || !seen;
}

type Store = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage key: whether this tab's home page was built with the opening, so a reload keeps the same world (and so the same scene under the scroll position). */
export const WORLD_KEY = "sn-opening-world";

/** The flag the tab stored, or null (none, or storage blocked: the caller decides afresh). */
export function rememberedWorld(store?: Store): boolean | null {
  try {
    const v = (store ?? sessionStorage).getItem(WORLD_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/** sessionStorage key: where an opening page was scrolled to when it was left, for the reload to scroll back to once the page's spacer is in place. */
export const SCROLL_KEY = "sn-opening-scroll";

export function rememberScroll(y: number, store?: Store): void {
  try {
    (store ?? sessionStorage).setItem(SCROLL_KEY, String(Math.max(0, Math.round(y))));
  } catch {
    /* blocked: the reload starts at the top */
  }
}

/** The stored scroll in px, or null (none, not a number, or storage blocked). */
export function rememberedScroll(store?: Store): number | null {
  try {
    const v = (store ?? sessionStorage).getItem(SCROLL_KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function rememberWorld(opening: boolean, store?: Store): void {
  try {
    (store ?? sessionStorage).setItem(WORLD_KEY, opening ? "1" : "0");
  } catch {
    /* blocked: a reload decides afresh */
  }
}

/** Blocked storage (private mode, a policy) counts as not seen; nothing here throws. */
export function wasOpened(store?: Store): boolean {
  try {
    return (store ?? localStorage).getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOpened(store?: Store): void {
  try {
    (store ?? localStorage).setItem(OPENED_KEY, "1");
  } catch {
    /* blocked: the opening plays again next time */
  }
}
