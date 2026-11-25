import { describe, expect, it } from "vitest";
import { inkPlan, joinMask, joinPlan, joinReady, lightDisc, lightPath, MAX_ZOOM, nightfallEdge, nightfallRise, OVERLAY, SHOW_A, SHOW_B, type JoinView } from "../../lib/world/joins";
import { homeWorld } from "../../lib/world/home";
import type { TransitionKind } from "../../lib/world/types";

const view = { w: 40, h: 30 };
const KINDS: TransitionKind[] = ["through", "match", "curl", "ink", "nightfall", "light"];
const MIXES = Array.from({ length: 21 }, (_, i) => i / 20);
const pa = { x: 12, y: 9 };
const pb = { x: 28, y: 21 };
const lights = Array.from({ length: 3 }, (_, i) => ({ from: { x: 5 + i * 10, y: 6 }, to: { x: 8 + i * 10, y: 22 } }));
const ink = { w: 40, h: 30, data: new Uint8ClampedArray(Array.from({ length: 40 * 30 }, () => [28, 26, 20, 255]).flat()) };
const jv: JoinView = { pa, pb, ink, inkAt: { x: 0, y: 0 }, lights };
const mask = (kind: TransitionKind, mix: number, v: JoinView = jv) => {
  const buf = new Uint8ClampedArray(view.w * view.h * 4);
  joinMask(buf, view, kind, mix, v);
  return buf;
};
const alphas = (buf: Uint8ClampedArray) => Array.from({ length: buf.length / 4 }, (_, i) => buf[i * 4 + 3]);

describe("nightfallRise", () => {
  it("is lifted at 0.2, at rest from 0.9, and only ever moves toward rest", () => {
    expect(nightfallRise(0.2)).toBeLessThan(0);
    for (const m of [0.9, 0.95, 1]) expect(nightfallRise(m)).toBe(0);
    for (let i = 1; i < MIXES.length; i++) expect(nightfallRise(MIXES[i]), `${MIXES[i]}`).toBeGreaterThanOrEqual(nightfallRise(MIXES[i - 1]));
  });
});

describe("joinPlan", () => {
  it("never zooms past 4 or below 1, for any kind at any mix", () => {
    for (const k of KINDS) for (const m of MIXES) {
      const p = joinPlan(k, m, view, pa, pb);
      for (const z of [p.a.z, p.b.z]) expect(z, `${k} ${m}`).toBeGreaterThanOrEqual(1);
      for (const z of [p.a.z, p.b.z]) expect(z, `${k} ${m}`).toBeLessThanOrEqual(MAX_ZOOM);
    }
  });
  it("A starts as it rests and B ends as it rests", () => {
    for (const k of KINDS) {
      expect(joinPlan(k, 0, view, pa, pb).a).toEqual({ ax: pa.x, ay: pa.y, dx: pa.x, dy: pa.y, z: 1 });
      expect(joinPlan(k, 1, view, pa, pb).b).toEqual({ ax: pb.x, ay: pb.y, dx: pb.x, dy: pb.y, z: 1 });
    }
  });
  it("through and match: both anchors meet at the screen centre at 4x when the swap happens", () => {
    for (const k of ["through", "match"] as const) {
      const { a, b } = joinPlan(k, 0.5, view, pa, pb);
      expect([a.dx, a.dy, a.z]).toEqual([20, 15, MAX_ZOOM]);
      expect([b.dx, b.dy, b.z]).toEqual([20, 15, MAX_ZOOM]);
    }
  });
  it("ink zooms A into its anchor to 4x by mix 0.5, with the anchor landing where B's anchor sits at rest; the light joins, nightfall and curl never zoom", () => {
    const { a, b } = joinPlan("ink", 0.5, view, pa, pb);
    expect([a.dx, a.dy, a.z, b.z]).toEqual([pb.x, pb.y, MAX_ZOOM, 1]);
    for (const k of ["curl", "nightfall", "light"] as const) expect(joinPlan(k, 0.5, view, pa, pb).a.z).toBe(1);
  });
  it("an anchor near an edge never pulls the enlarged source outside the view", () => {
    const edge = { x: view.w - 2, y: 2 };
    for (const k of ["through", "match", "ink"] as const) for (const m of [0.25, 0.75]) {
      const p = joinPlan(k, m, view, edge, edge);
      for (const z of [p.a, p.b]) {
        const [sx, sy] = [z.ax - z.dx / z.z, z.ay - z.dy / z.z];
        expect(sx, `${k} ${m}`).toBeGreaterThanOrEqual(-1e-9);
        expect(sy, `${k} ${m}`).toBeGreaterThanOrEqual(-1e-9);
        expect(sx + view.w / z.z, `${k} ${m}`).toBeLessThanOrEqual(view.w + 1e-9);
        expect(sy + view.h / z.z, `${k} ${m}`).toBeLessThanOrEqual(view.h + 1e-9);
      }
    }
  });
});

describe("joinMask", () => {
  it("shows only A at mix 0 and only B at mix 1, for every kind (the twelve lights aside)", () => {
    for (const k of KINDS.filter((k) => k !== "nightfall")) {
      expect(new Set(alphas(mask(k, 0))), k).toEqual(new Set([SHOW_A]));
      expect(new Set(alphas(mask(k, 1))), k).toEqual(new Set([SHOW_B]));
    }
    for (const m of [0, 1]) expect(alphas(mask("nightfall", m)).every((a) => a === (m ? SHOW_B : SHOW_A) || a === OVERLAY)).toBe(true);
  });
  it("only ever says A, B or overlay: nothing in between", () => {
    const ok = new Set([SHOW_A, SHOW_B, OVERLAY]);
    for (const k of KINDS) for (const m of MIXES) expect(alphas(mask(k, m)).every((a) => ok.has(a)), `${k} ${m}`).toBe(true);
  });
  it("no join dissolves: at 0.25, 0.5 and 0.75 each row changes side at most 4 times", () => {
    for (const k of KINDS) for (const m of [0.25, 0.5, 0.75]) {
      const a = alphas(mask(k, m));
      for (let y = 0; y < view.h; y++) {
        const row = a.slice(y * view.w, (y + 1) * view.w).filter((v) => v !== OVERLAY);
        const flips = row.filter((v, i) => i > 0 && v !== row[i - 1]).length;
        expect(flips, `${k} ${m} row ${y}`).toBeLessThanOrEqual(4);
      }
    }
    for (const k of KINDS) for (const m of [0.25, 0.5, 0.75]) {
      const a = alphas(mask(k, m, { ...jv, lights: [] }));
      for (let y = 0; y < view.h; y++) {
        const row = a.slice(y * view.w, (y + 1) * view.w);
        const flips = row.filter((v, i) => i > 0 && v !== row[i - 1]).length;
        expect(flips, `${k} ${m} row ${y} (with overlay)`).toBeLessThanOrEqual(4);
      }
    }
  });
  it("B only gains pixels as the mix grows (match, through, ink, nightfall, curl)", () => {
    for (const k of ["match", "through", "ink", "nightfall", "curl"] as const) {
      let prev = new Set<number>();
      for (const m of MIXES) {
        const now = new Set(alphas(mask(k, m, { ...jv, lights: [] })).flatMap((a, i) => (a === SHOW_B ? [i] : [])));
        expect([...prev].every((i) => now.has(i)), `${k} ${m}`).toBe(true);
        prev = now;
      }
    }
  });
  it("match is one hard cut at the middle", () => {
    expect(new Set(alphas(mask("match", 0.49)))).toEqual(new Set([SHOW_A]));
    expect(new Set(alphas(mask("match", 0.5)))).toEqual(new Set([SHOW_B]));
  });
  it("through: B grows from the centre as a rectangle after mix 0.5", () => {
    expect(new Set(alphas(mask("through", 0.5)))).toEqual(new Set([SHOW_A]));
    const a = alphas(mask("through", 0.75));
    expect(a[15 * view.w + 20]).toBe(SHOW_B);
    expect(a[0]).toBe(SHOW_A);
  });
  it("curl: a hard roll edge of paper and tan sweeps down with B behind it", () => {
    const buf = mask("curl", 0.5); // the edge is at row round(-3 + 33 / 2) = 14
    const row = (y: number) => Array.from(buf.slice(y * view.w * 4, y * view.w * 4 + 4));
    expect(row(13)[3]).toBe(SHOW_B);
    expect(row(14)).toEqual([0xf1, 0xe7, 0xcc, OVERLAY]);
    expect(row(15)).toEqual([0xf1, 0xe7, 0xcc, OVERLAY]);
    expect(row(16)).toEqual([0xd0, 0x90, 0x4e, OVERLAY]);
    expect(row(17)[3]).toBe(SHOW_A);
  });
  it("ink: A until 0.5, then B's ink image at rest, then colour spreads in a hard disc round B's anchor", () => {
    expect(new Set(alphas(mask("ink", 0.49)))).toEqual(new Set([SHOW_A]));
    expect(new Set(alphas(mask("ink", 0.5)))).toEqual(new Set([OVERLAY]));
    expect(new Set(alphas(mask("ink", 0.6)))).toEqual(new Set([OVERLAY]));
    const a = alphas(mask("ink", 0.8));
    expect(a[pb.y * view.w + pb.x]).toBe(SHOW_B);
    expect(a[0]).toBe(OVERLAY);
    expect(Array.from(mask("ink", 0.5).slice(0, 4))).toEqual([28, 26, 20, OVERLAY]);
  });
  it("nightfall: a hard slanted edge crosses left to right with B behind it; the twelve lights sit on top", () => {
    expect(nightfallEdge(0.1, view)).toBeLessThan(0);
    expect(nightfallEdge(0.6, view)).toBeGreaterThanOrEqual(view.w);
    const buf = mask("nightfall", 0.35);
    const a = alphas(buf);
    const rowB = (y: number) => a.slice(y * view.w, (y + 1) * view.w).filter((v) => v === SHOW_B).length;
    expect(rowB(0)).not.toBe(rowB(view.h - 1)); // slanted
    const px = (dx: number, dy: number) => {
      const o = ((lights[0].from.y + dy) * view.w + lights[0].from.x + dx) * 4;
      return [buf[o], buf[o + 1], buf[o + 2], buf[o + 3]];
    };
    expect(px(0, 0)).toEqual([255, 246, 220, OVERLAY]); // a white core
    expect(px(1, 0)).toEqual([255, 208, 106, OVERLAY]); // sun arms
    expect(px(0, -2)).toEqual([233, 168, 32, OVERLAY]); // gold tips
    expect(px(1, 1)[3]).not.toBe(OVERLAY); // a star, not a square
  });
  it("light: a hard disc of light grows from A's anchor to cover the view at 0.5, then shrinks onto B's", () => {
    expect(new Set(alphas(mask("light", 0.5)))).toEqual(new Set([OVERLAY]));
    const early = alphas(mask("light", 0.2));
    expect(early[pa.y * view.w + pa.x]).toBe(OVERLAY);
    expect(early[0]).toBe(SHOW_A);
    const late = alphas(mask("light", 0.8));
    expect(late[pb.y * view.w + pb.x]).toBe(OVERLAY);
    expect(late[0]).toBe(SHOW_B);
  });
});

describe("pure functions of the mix (a join reverses cleanly)", () => {
  it("inkPlan: zoom, ink and colour radius depend on the mix alone, colour grows in 8 steps", () => {
    const first = MIXES.map((m) => inkPlan(m));
    [...MIXES].reverse().forEach((m, i) => expect(inkPlan(m)).toEqual(first[MIXES.length - 1 - i]));
    expect(inkPlan(0)).toEqual({ zoomA: 1, showInk: false, colourR: 0 });
    expect(inkPlan(0.5).zoomA).toBe(MAX_ZOOM);
    expect(inkPlan(0.49).showInk).toBe(false);
    expect(inkPlan(0.5).showInk).toBe(true);
    expect(inkPlan(0.6).colourR).toBe(0);
    expect(inkPlan(1).colourR).toBe(1);
    const steps = new Set(Array.from({ length: 401 }, (_, i) => inkPlan(0.6 + i / 1000).colourR));
    expect(steps.size).toBe(9);
  });
  it("nightfallEdge only moves right and ignores what came before", () => {
    const edges = MIXES.map((m) => nightfallEdge(m, view));
    expect(edges).toEqual([...edges].sort((a, b) => a - b));
    expect(nightfallEdge(0.3, view)).toBe(nightfallEdge(0.3, view));
    for (const e of edges) expect(Number.isInteger(e)).toBe(true);
  });
  it("lightPath holds at from until 0.3, lands on to by 0.9, whole numbers all the way", () => {
    const from = { x: 10, y: 20 };
    const to = { x: 70, y: 5 };
    expect(lightPath(0, 0, from, to)).toEqual(from);
    expect(lightPath(0, 0.3, from, to)).toEqual(from);
    expect(lightPath(0, 0.9, from, to)).toEqual(to);
    expect(lightPath(0, 1, from, to)).toEqual(to);
    for (const m of MIXES) {
      const p = lightPath(3, m, from, to);
      expect(Number.isInteger(p.x) && Number.isInteger(p.y), `${m}`).toBe(true);
      expect(p).toEqual(lightPath(3, m, from, to));
    }
  });
  it("lightDisc: small at both ends, covers the view at 0.5, centre a then b", () => {
    expect(lightDisc(0.05, view).r).toBeLessThan(12);
    expect(lightDisc(0.95, view).r).toBeLessThan(12);
    expect(lightDisc(0.5, view).r).toBeGreaterThanOrEqual(Math.hypot(view.w, view.h));
    expect(lightDisc(0.49, view).centre).toBe("a");
    expect(lightDisc(0.51, view).centre).toBe("b");
    expect(lightDisc(0.3, view)).toEqual(lightDisc(0.3, view));
    expect(Number.isInteger(lightDisc(0.37, view).r)).toBe(true);
  });
  it("a mask does not depend on the mix drawn before it", () => {
    for (const k of KINDS) for (const [m1, m2] of [[0.2, 0.7], [0.7, 0.2], [0.5, 0.45]]) {
      const fresh = alphas(mask(k, m2));
      mask(k, m1);
      const after = alphas(mask(k, m2));
      expect(after, `${k} ${m1}->${m2}`).toEqual(fresh);
    }
  });
});

describe("the home world's joins", () => {
  it("none dissolves: the same checks on the real joins' kinds", () => {
    const kinds = homeWorld("sunset", { opening: false }).joins.map((j) => j.kind);
    for (const k of kinds) {
      expect(KINDS).toContain(k);
      for (const m of [0.25, 0.5, 0.75]) {
        const a = alphas(mask(k, m, { ...jv, lights: [] }));
        for (let y = 0; y < view.h; y++) {
          const row = a.slice(y * view.w, (y + 1) * view.w);
          const flips = row.filter((v, i) => i > 0 && v !== row[i - 1]).length;
          expect(flips, `${k} ${m} row ${y}`).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe("joinReady", () => {
  it("needs the anchors the kind aims at", () => {
    expect(joinReady("through", { a: "slate" })).toBe(true);
    expect(joinReady("through", {})).toBe(false);
    expect(joinReady("match", { a: "spiral" })).toBe(false);
    expect(joinReady("match", { a: "spiral", b: "wheel" })).toBe(true);
    expect(joinReady("ink", { a: "page", b: "spiral" })).toBe(true);
    expect(joinReady("ink", { a: "page" })).toBe(false);
    expect(joinReady("light", { a: "star", b: "lantern" })).toBe(true);
    expect(joinReady("light", { a: "star" })).toBe(false);
    for (const k of ["curl", "nightfall"]) expect(joinReady(k, {})).toBe(true);
    for (const k of ["push", "wipe", "roll", "dither", "fly", "dissolve"]) expect(joinReady(k, { a: "x", b: "y" })).toBe(false);
  });
});
