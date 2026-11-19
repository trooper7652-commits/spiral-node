/** Email popup rules and storage. shouldShow is pure; readState/writeState never throw. */
export const DAY_MS = 86_400_000;
export const SHOW_AFTER_MS = 60_000;
export const DISMISS_DAYS = 30;
const KEY = "spiral-node-popup";

export type PopupState = { dismissedAt?: number; subscribed?: boolean };
export type ShowInput = PopupState & {
  now: number;
  visibleMs: number;
  path: string;
  demoRunning: boolean;
  forced: boolean;
  formUrl: string;
};

export function shouldShow(s: ShowInput): boolean {
  if (s.path.startsWith("/try")) return false; // never on the simulator page, even when forced
  if (s.demoRunning) return false; // never while the hero demo runs, even when forced
  if (s.forced) return true;
  if (!s.formUrl) return false;
  if (s.subscribed) return false;
  if (s.dismissedAt !== undefined && s.now - s.dismissedAt < DISMISS_DAYS * DAY_MS) return false;
  return s.visibleMs >= SHOW_AFTER_MS;
}

let memory: PopupState = {}; // used when localStorage is blocked (private windows, Safari ITP)

export function readState(): PopupState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as PopupState;
      return { dismissedAt: typeof v.dismissedAt === "number" ? v.dismissedAt : undefined, subscribed: v.subscribed === true };
    }
  } catch {
    // storage blocked or bad JSON: fall back to this page's memory
  }
  return { ...memory };
}

export function writeState(next: PopupState): void {
  memory = { ...readState(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: memory still holds it for this page view
  }
}
