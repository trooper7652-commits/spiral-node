import { describe, expect, it } from "vitest";
import { frameAt, holdPx, totalPx } from "../../lib/world/frame";
import { ease } from "../../lib/world/ease";
import type { Ease, Key, World } from "../../lib/world/types";

const k = (at: number, x: number, y: number, zoom: number, ease?: Ease): Key => ({ at, cam: { x, y, zoom, rot: 0 }, ...(ease ? { ease } : {}) });
const art = (n: string) => ({ wide: `/${n}/wide/manifest.json`, tall: `/${n}/tall/manifest.json` });
const world: World = {
  shots: [
    {
      id: "one", art: art("one"), lengthVh: 300,
      keys: [k(0, 0.5, 0.5, 1), k(1, 0.6, 0.4, 2)],
      holds: [{ id: "intro", from: 0.2, to: 0.6, dock: "left" }],
    },
    {
      id: "two", art: art("two"), lengthVh: 200,
      keys: [k(0, 0.4, 0.5, 1.5), k(0.5, 0.5, 0.5, 1, "linear"), k(1, 0.5, 0.5, 1)],
      holds: [{ id: "second", from: 0.3, to: 0.9, dock: "right" }],
    },
  ],
  joins: [{ kind: "curl", lengthVh: 150, params: {} }],
};
const L = { w: 1440, h: 900 }; // vh = 9 px: shot one 0..2700, join 2700..4050, shot two 4050..5850
const P = { w: 390, h: 844 };

describe("totalPx", () => {
  it("= sum of lengthVh × h / 100", () => {
    expect(totalPx(world, 900)).toBe(5850);
    expect(totalPx(world, 1000)).toBe(6500);
  });
});

describe("frameAt", () => {
  it("at 0 is the first shot's first key", () => {
    const f = frameAt(world, 0, L);
    expect(f).toEqual({ a: { shot: "one", cam: { x: 0.5, y: 0.5, zoom: 1, rot: 0 } }, mix: 0, kind: null, hold: null });
    expect("b" in f).toBe(false);
    expect(frameAt(world, -500, L)).toEqual(f);
    const end = frameAt(world, 5850, L);
    expect(frameAt(world, 99999, L)).toEqual(end);
    expect(end.a.shot).toBe("two");
  });

  it("mix runs 0→1 across a join and is null kind inside a shot", () => {
    const us = [0.1, 0.25, 0.5, 0.75, 0.9];
    let prev = -1;
    for (const u of us) {
      const f = frameAt(world, 2700 + 1350 * u, L);
      expect(f.kind).toBe("curl");
      expect(f.mix).toBeCloseTo(u, 6);
      expect(f.a).toEqual({ shot: "one", cam: { x: 0.6, y: 0.4, zoom: 2, rot: 0 } });
      expect(f.b).toEqual({ shot: "two", cam: { x: 0.4, y: 0.5, zoom: 1.5, rot: 0 } });
      expect(f.hold).toBeNull();
      expect(f.mix).toBeGreaterThan(prev);
      prev = f.mix;
    }
    for (const px of [1000, 5000]) {
      const f = frameAt(world, px, L);
      expect(f.kind).toBeNull();
      expect(f.mix).toBe(0);
      expect("b" in f).toBe(false);
    }
    const s = frameAt(world, 2700, L);
    expect(s.a.shot).toBe("one");
    expect(s.kind).toBeNull();
    const e = frameAt(world, 4050, L);
    expect(e.a.shot).toBe("two");
    expect(e.kind).toBeNull();
    expect(e.a.cam).toEqual(frameAt(world, 2700 + 1350 * 0.5, L).b!.cam);
  });

  it("hold is set only between its from/to and never inside a join", () => {
    const h = (t: number) => frameAt(world, t * 2700, L).hold;
    expect(h(0.1)).toBeNull();
    for (const t of [0.2, 0.3, 0.59, 0.6]) expect(h(t)).toBe("intro");
    expect(h(0.7)).toBeNull();
    for (let px = 2701; px <= 4049; px += 40) expect(frameAt(world, px, L).hold).toBeNull();
    expect(frameAt(world, 4050 + 1800 * 0.5, L).hold).toBe("second");
    expect(frameAt(world, 4050 + 1800 * 0.95, L).hold).toBeNull();
  });

  it("holdT runs 0..1 through a hold and holdPx is its middle", () => {
    expect(frameAt(world, 2700 * 0.2, L).holdT).toBeCloseTo(0, 6);
    expect(frameAt(world, 2700 * 0.4, L).holdT).toBeCloseTo(0.5, 6);
    expect("holdT" in frameAt(world, 2700 * 0.1, L)).toBe(false);
    for (const [id, vp] of [["intro", L], ["second", L], ["second", P]] as const) {
      const f = frameAt(world, holdPx(world, id, vp), vp);
      expect(f.hold).toBe(id);
      expect(f.holdT).toBeCloseTo(0.5, 6);
    }
    expect(() => holdPx(world, "nope", L)).toThrow();
  });

  it("the camera on screen does not jump between adjacent samples at either seam", () => {
    // Left of a seam the picture is shot one (then the join's A, the same key); right of the second seam it is shot two, which the join's B already showed.
    const shown = (px: number) => {
      const f = frameAt(world, px, L);
      return f.mix > 0.5 ? f.b!.cam : f.a.cam;
    };
    for (const seam of [2700, 4050]) {
      let prev = shown(seam - 3);
      for (let px = seam - 2.5; px <= seam + 3; px += 0.5) {
        const c = shown(px);
        for (const k of ["x", "y", "zoom", "rot"] as const) expect(Math.abs(c[k] - prev[k]), `${k} at ${px}`).toBeLessThan(2e-3);
        prev = c;
      }
    }
  });

  it("pure: scrolling 0→end→0 gives identical frames at the same px", () => {
    const px = Array.from({ length: 200 }, (_, i) => (i * 5850) / 199);
    const down = px.map((p) => frameAt(world, p, L));
    const up = [...px].reverse().map((p) => frameAt(world, p, L)).reverse();
    expect(up).toEqual(down);
    expect(down.some((f) => JSON.stringify(f) !== JSON.stringify(down[0]))).toBe(true);
  });

  it("a portrait viewport uses the same keys", () => {
    expect(frameAt(world, 0, P).a.cam).toEqual(frameAt(world, 0, L).a.cam);
    expect(frameAt(world, (300 + 150) * 8.44, P).a.cam).toEqual({ x: 0.4, y: 0.5, zoom: 1.5, rot: 0 });
  });

  it("cameras ease between keys (inOut cubic default, zoom in log space)", () => {
    const m = frameAt(world, 1350, L).a.cam;
    expect(m.x).toBeCloseTo(0.55, 6);
    expect(m.y).toBeCloseTo(0.45, 6);
    expect(m.zoom).toBeCloseTo(Math.SQRT2, 6);
    expect(frameAt(world, 675, L).a.cam.x).toBeCloseTo(0.5 + 0.1 * 0.0625, 6);
    const c = frameAt(world, 4050 + 180, L).a.cam;
    expect(c.x).toBeCloseTo(0.42, 6);
    expect(c.zoom).toBeCloseTo(1.5 * Math.pow(1 / 1.5, 0.2), 6);
  });
});

describe("ease", () => {
  it("curves", () => {
    expect(ease("inOut", 0)).toBe(0);
    expect(ease("inOut", 0.5)).toBeCloseTo(0.5, 6);
    expect(ease("inOut", 1)).toBe(1);
    expect(ease("inOut", 0.25)).toBeCloseTo(0.0625, 6);
    expect(ease("out", 0.5)).toBeCloseTo(0.875, 6);
    expect(ease("linear", 0.3)).toBeCloseTo(0.3, 6);
    expect(ease("linear", -1)).toBe(0);
    expect(ease("linear", 2)).toBe(1);
  });
});

describe("invalid worlds", () => {
  it("throw", () => {
    expect(() => frameAt({ shots: [], joins: [] }, 0, L)).toThrow();
    expect(() => frameAt({ shots: world.shots, joins: [] }, 0, L)).toThrow();
    expect(() => frameAt({ shots: [{ ...world.shots[0], keys: [] }], joins: [] }, 0, L)).toThrow();
  });
});
