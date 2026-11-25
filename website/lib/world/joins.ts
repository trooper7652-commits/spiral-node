import { ease } from "./ease";
import type { TransitionKind } from "./types";

type Size = { w: number; h: number };
type Params = Record<string, number | string>;
export type Pt = { x: number; y: number };
/** RGBA pixels of a small image. */
export type Sheet = { w: number; h: number; data: Uint8ClampedArray };
/** What a join reads besides the mix, in view pixels: the anchors it aims at, B's ink image and where its corner sits, the lights' two ends. */
export type JoinView = { pa: Pt; pb: Pt; ink: Sheet | null; inkAt: Pt; lights: { from: Pt; to: Pt }[] };
/** The source point (ax, ay) is drawn at (dx, dy), enlarged z times with hard pixels. All in art pixels of the view. */
export type Zoom = { ax: number; ay: number; dx: number; dy: number; z: number };

export const MAX_ZOOM = 4;
/** The mask's alpha: which of the three a pixel shows. Overlay pixels carry their own colour in rgb. */
export const SHOW_A = 0;
export const SHOW_B = 128;
export const OVERLAY = 255;

const PAPER = 0xf1e7cc;
const TAN = 0xd0904e;
const LIGHT = 0xffd06a; // palette "sun": the colour of the lights and of the disc
const ROLL = [PAPER, PAPER, TAN]; // the roll's edge, top to bottom
const WHITE = 0xfff6dc; // palette "white"
const GOLD = 0xe9a820; // palette "gold"
/** Nightfall: each light is a small star, like scene 6's markers: a white core, sun arms, gold tips. */
const STAR: [number, number, number][] = [
  [0, 0, WHITE],
  ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [dx, dy, LIGHT] as [number, number, number]),
  ...[[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [dx, dy, GOLD] as [number, number, number]),
];
const SLANT = 0.3; // nightfall: the shadow edge moves this many pixels sideways per row
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const NEEDS: Record<TransitionKind, string[]> = { through: ["a"], match: ["a", "b"], curl: [], ink: ["a", "b"], nightfall: [], light: ["a", "b"] };

/** True when the kind is known and every anchor name it aims at is there. */
export function joinReady(kind: string, p: Params) {
  const need = NEEDS[kind as TransitionKind];
  return !!need && need.every((k) => typeof p[k] === "string" && p[k] !== "");
}

/** Where a zoomed source starts: the anchor drawn at d, zoom z, kept so the source window (v / z wide) stays inside 0..v. */
const keepInside = (a: number, d: number, z: number, v: number) => Math.min(a * z, Math.max((a - (v - v / z)) * z, d));

/**
 * How each side of a join is drawn. Through and match zoom A (1 to 4) up to mix 0.5 with their anchor moving to the
 * screen centre, then B comes down from 4 to 1 and its anchor moves out to its own place. Ink zooms A the same way, but
 * its anchor moves onto B's anchor (not the centre) and B stays at rest. The rest stay at 1. pa, pb: the anchors in view pixels.
 */
export function joinPlan(kind: TransitionKind, mix: number, view: Size, pa: Pt, pb: Pt): { a: Zoom; b: Zoom } {
  const still = (p: Pt): Zoom => ({ ax: p.x, ay: p.y, dx: p.x, dy: p.y, z: 1 });
  const u = ease("inOut", Math.min(1, 2 * mix));
  const side = (p: Pt, d: Pt, z: number): Zoom => ({ ax: p.x, ay: p.y, dx: keepInside(p.x, d.x, z, view.w), dy: keepInside(p.y, d.y, z, view.h), z });
  if (kind !== "through" && kind !== "match" && kind !== "ink") return { a: still(pa), b: still(pb) };
  const c = { x: view.w / 2, y: view.h / 2 };
  if (kind === "ink") return { a: side(pa, { x: lerp(pa.x, pb.x, u), y: lerp(pa.y, pb.y, u) }, inkPlan(mix).zoomA), b: still(pb) }; // A's anchor glides onto B's, where B's ink starts
  const a = side(pa, { x: lerp(pa.x, c.x, u), y: lerp(pa.y, c.y, u) }, inkPlan(mix).zoomA);
  const v = ease("inOut", Math.max(0, 2 * mix - 1));
  return { a, b: side(pb, { x: lerp(c.x, pb.x, v), y: lerp(c.y, pb.y, v) }, MAX_ZOOM ** (1 - v)) };
}

/** Ink: A's zoom into the page (to mix 0.5), whether B's ink image shows (from 0.5), and the colour disc's radius as a fraction of the view diagonal (8 steps from 0.6 to 1). */
export function inkPlan(mix: number): { zoomA: number; showInk: boolean; colourR: number } {
  return {
    zoomA: MAX_ZOOM ** ease("inOut", Math.min(1, 2 * mix)),
    showInk: mix >= 0.5,
    colourR: Math.ceil(8 * clamp01((mix - 0.6) / 0.4)) / 8,
  };
}

/** Nightfall: the x of the shadow edge at the middle row, crossing the view from mix 0.1 to 0.6 (slanted by SLANT per row); off the view at both ends. */
export function nightfallEdge(mix: number, view: Size): number {
  const slack = Math.ceil((SLANT * view.h) / 2) + 1;
  return Math.round(lerp(-slack, view.w + slack, ease("inOut", (mix - 0.1) / 0.5)));
}

/** Nightfall: light i holds at `from` until mix 0.3, then eases to `to` by 0.9. Whole pixels. */
export function lightPath(_i: number, mix: number, from: Pt, to: Pt): Pt {
  const t = ease("inOut", (mix - 0.3) / 0.6);
  return { x: Math.round(lerp(from.x, to.x, t)), y: Math.round(lerp(from.y, to.y, t)) };
}

/** Nightfall: B's camera y offset (a fraction of the scene). The hilltop starts lower and rises to rest by mix 0.9; the depth-0 stars, and so the lights' targets, do not move. */
export const nightfallRise = (mix: number) => 0.08 * (ease("inOut", (mix - 0.1) / 0.8) - 1);

/** Light: the disc's whole-pixel radius, growing from anchor a to cover the view at mix 0.5, then shrinking onto anchor b. */
export function lightDisc(mix: number, view: Size): { r: number; centre: "a" | "b" } {
  const p = 1 - Math.abs(2 * clamp01(mix) - 1);
  return { r: Math.ceil(Math.hypot(view.w, view.h) * p * p), centre: mix < 0.5 ? "a" : "b" };
}

/**
 * Fills `buf` (view.w x view.h RGBA) with the join's hard reveal: alpha SHOW_A, SHOW_B or OVERLAY (then rgb is the colour
 * to draw). Every pixel is whole A, whole B or a palette pixel of the join's own; nothing is ever blended.
 */
export function joinMask(buf: Uint8ClampedArray, view: Size, kind: TransitionKind, mix: number, jv: Partial<JoinView> = {}) {
  const { w, h } = view;
  const { pa = { x: w / 2, y: h / 2 }, pb = { x: w / 2, y: h / 2 }, ink = null, inkAt = { x: 0, y: 0 }, lights = [] } = jv;
  const grow = ease("inOut", Math.max(0, 2 * mix - 1)); // through: the rectangle of B
  const edge = Math.round(lerp(-ROLL.length, h, mix)); // curl: the row where the roll sits
  const ip = inkPlan(mix);
  const inkR = Math.round(ip.colourR * Math.hypot(w, h));
  const night = nightfallEdge(mix, view);
  const disc = lightDisc(mix, view);
  const dc = disc.centre === "a" ? pa : pb;
  const dcx = Math.min(w, Math.max(0, dc.x)); // a centre outside the view still covers it at the middle
  const dcy = Math.min(h, Math.max(0, dc.y));
  const sx = w / 2;
  const sy = h / 2;
  const rx = sx * grow;
  const ry = sy * grow;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let pick = SHOW_A; // SHOW_A, SHOW_B or OVERLAY (with the colour in rgb)
      let rgb = 0;
      if (kind === "through") {
        if (grow > 0 && mix >= 0.5 && Math.abs(x + 0.5 - sx) <= rx && Math.abs(y + 0.5 - sy) <= ry) pick = SHOW_B;
      } else if (kind === "match") {
        if (mix >= 0.5) pick = SHOW_B; // both sides sit at 4x on their anchors: one hard cut
      } else if (kind === "curl") {
        if (y < edge) pick = SHOW_B;
        else if (y < edge + ROLL.length) {
          pick = OVERLAY;
          rgb = ROLL[y - edge];
        }
      } else if (kind === "ink") {
        if (ip.showInk) {
          pick = SHOW_B;
          if (Math.hypot(x + 0.5 - pb.x, y + 0.5 - pb.y) > inkR) {
            const ix = x - inkAt.x;
            const iy = y - inkAt.y;
            if (ink && ix >= 0 && iy >= 0 && ix < ink.w && iy < ink.h) {
              const i = (iy * ink.w + ix) * 4;
              pick = OVERLAY;
              rgb = (ink.data[i] << 16) | (ink.data[i + 1] << 8) | ink.data[i + 2];
            }
          }
        }
      } else if (kind === "nightfall") {
        if (x < Math.round(night + SLANT * (y - sy))) pick = SHOW_B;
      } else if (kind === "light") {
        pick = mix >= 0.5 ? SHOW_B : SHOW_A;
        if (Math.hypot(x + 0.5 - dcx, y + 0.5 - dcy) <= disc.r) {
          pick = OVERLAY;
          rgb = LIGHT;
        }
      }
      const o = (y * w + x) * 4;
      buf[o] = rgb >> 16;
      buf[o + 1] = (rgb >> 8) & 255;
      buf[o + 2] = rgb & 255;
      buf[o + 3] = pick;
    }
  }
  if (kind === "nightfall")
    lights.forEach((l, i) => {
      const p = lightPath(i, mix, l.from, l.to);
      for (const [dx, dy, c] of STAR) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const o = (y * w + x) * 4;
        buf[o] = c >> 16;
        buf[o + 1] = (c >> 8) & 255;
        buf[o + 2] = c & 255;
        buf[o + 3] = OVERLAY;
      }
    });
}
