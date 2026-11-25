import type { Camera, SceneArt } from "./types";

/** What the page needs to pin DOM to the art: the shot at rest in a hold, its manifest, camera and view (art px), k (device px per art px) and dpr. */
export type Stage = { shot: string; hold: string; holdT: number; art: SceneArt; cam: Camera; view: { w: number; h: number }; k: number; dpr: number };

let now: Stage | null = null;
const subs = new Set<(s: Stage | null) => void>();

const same = (a: Stage | null, b: Stage | null) =>
  a === b ||
  (!!a && !!b && a.art === b.art && a.shot === b.shot && a.hold === b.hold && a.holdT === b.holdT && a.cam.x === b.cam.x && a.cam.y === b.cam.y &&
    a.view.w === b.view.w && a.view.h === b.view.h && a.k === b.k && a.dpr === b.dpr);

export const getStage = () => now;

/** Called by the canvas every frame; subscribers hear only a change. null: no shot at rest in a hold. */
export function setStage(s: Stage | null) {
  if (same(now, s)) return;
  now = s;
  subs.forEach((f) => f(s));
}

export function subscribeStage(f: (s: Stage | null) => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
