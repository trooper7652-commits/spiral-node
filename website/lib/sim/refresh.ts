/** E-ink refresh effect timeline. Pure, so the flash budget is unit-tested. */
export type Step = { fill: "ink" | "paper" | "frame"; ms: number; ghost?: boolean };

export const FULL_MS = 700;
export const GHOST_MS = 250;
/** Minimum start-to-start gap between flashing refreshes: 2 flashes each, so 800 ms keeps any 1 s window at 3 or fewer. */
export const FULL_GAP_MS = 800;

/**
 * realism off: a plain swap. Full: ink, paper, new frame (2 flashes in 700 ms). Partial: new frame with the
 * previous one fading out. A full request less than FULL_GAP_MS after the last flashing one is drawn as partial,
 * which keeps flashes at 3 per second or fewer.
 */
export function refreshPlan(realism: boolean, full: boolean, sinceLastFullMs: number): Step[] {
  if (!realism) return [{ fill: "frame", ms: 0 }];
  if (full && sinceLastFullMs >= FULL_GAP_MS)
    return [
      { fill: "ink", ms: 200 },
      { fill: "paper", ms: 200 },
      { fill: "frame", ms: FULL_MS - 400 },
    ];
  return [{ fill: "frame", ms: GHOST_MS, ghost: true }];
}
