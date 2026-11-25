import type { Ease } from "./types";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where the text is fully in, as a position through the hold. */
export const HOLD_IN = 0.25;

/** Text opacity through a hold: in over the first quarter, out over the last. */
export const holdOpacity = (holdT: number) => Math.min(smooth(0, HOLD_IN, holdT), 1 - smooth(0.75, 1, holdT));

/** u is clamped to 0..1. inOut: cubic ease-in-out. out: cubic ease-out. linear: u. */
export function ease(kind: Ease, u: number): number {
  const v = Math.min(1, Math.max(0, u));
  if (kind === "linear") return v;
  if (kind === "out") return 1 - Math.pow(1 - v, 3);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}
