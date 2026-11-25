import { ease } from "./ease";
import type { Camera, Frame, Key, World } from "./types";

type Viewport = { w: number; h: number };

function check(world: World): void {
  if (world.shots.length === 0) throw new Error("world has no shots");
  if (world.joins.length !== world.shots.length - 1) throw new Error("world needs one join between each pair of shots");
  for (const s of world.shots) if (s.keys.length === 0) throw new Error(`shot ${s.id} has no keys`);
}

export function totalPx(world: World, viewportH: number): number {
  check(world);
  const vh = viewportH / 100;
  return [...world.shots, ...world.joins].reduce((sum, seg) => sum + seg.lengthVh * vh, 0);
}

function camAt(keys: Key[], t: number): Camera {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first.at) return { ...first.cam };
  if (t >= last.at) return { ...last.cam };
  let i = 0;
  while (keys[i + 1].at < t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const e = ease(k1.ease ?? "inOut", (t - k0.at) / (k1.at - k0.at));
  const lerp = (a: number, b: number) => a + (b - a) * e;
  return {
    x: lerp(k0.cam.x, k1.cam.x),
    y: lerp(k0.cam.y, k1.cam.y),
    zoom: k0.cam.zoom * Math.pow(k1.cam.zoom / k0.cam.zoom, e),
    rot: lerp(k0.cam.rot, k1.cam.rot),
  };
}

/** The scroll px of a hold's middle. */
export function holdPx(world: World, holdId: string, viewport: Viewport): number {
  const vh = viewport.h / 100;
  let start = 0;
  for (let i = 0; i < world.shots.length; i++) {
    const s = world.shots[i];
    const h = s.holds.find((x) => x.id === holdId);
    if (h) return start + ((h.from + h.to) / 2) * s.lengthVh * vh;
    start += (s.lengthVh + (world.joins[i]?.lengthVh ?? 0)) * vh;
  }
  throw new Error(`no hold ${holdId}`);
}

export function frameAt(world: World, scrollPx: number, viewport: Viewport): Frame {
  const total = totalPx(world, viewport.h);
  const px = Math.min(total, Math.max(0, scrollPx));
  const vh = viewport.h / 100;
  const { shots, joins } = world;
  let start = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const len = shot.lengthVh * vh;
    if (len > 0 && px >= start && px <= start + len) {
      const t = (px - start) / len;
      const hold = shot.holds.find((h) => h.from <= t && t <= h.to);
      const f: Frame = { a: { shot: shot.id, cam: camAt(shot.keys, t) }, mix: 0, kind: null, hold: hold ? hold.id : null };
      if (hold) f.holdT = hold.to > hold.from ? (t - hold.from) / (hold.to - hold.from) : 0;
      return f;
    }
    start += len;
    if (i < joins.length) {
      const jlen = joins[i].lengthVh * vh;
      if (jlen > 0 && px > start && px < start + jlen) {
        const next = shots[i + 1];
        return {
          a: { shot: shot.id, cam: camAt(shot.keys, 1) },
          b: { shot: next.id, cam: camAt(next.keys, 0) },
          mix: (px - start) / jlen,
          kind: joins[i].kind,
          hold: null,
        };
      }
      start += jlen;
    }
  }
  // Unreachable unless trailing shots are zero length: settle on the last shot's end.
  const last = shots[shots.length - 1];
  return { a: { shot: last.id, cam: camAt(last.keys, 1) }, mix: 0, kind: null, hold: null };
}
