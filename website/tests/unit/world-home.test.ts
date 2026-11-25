import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { frameAt, holdPx, totalPx } from "../../lib/world/frame";
import { joinReady } from "../../lib/world/joins";
import { homeWorld as realHomeWorld, SECTIONS, spanVh } from "../../lib/world/home";

const L = { w: 1440, h: 900 };
const P = { w: 390, h: 844 };
const skies = ["sunset", "night"] as const;

const homeWorld = (sky: "sunset" | "night") => realHomeWorld(sky, { opening: false });

describe("homeWorld with the opening", () => {
  it("puts s0 first, without a hold, joined to s1 by a through join aimed at the screen; the rest is unchanged", () => {
    for (const sky of skies) {
      const plain = homeWorld(sky);
      const w = realHomeWorld(sky, { opening: true });
      expect(w.shots.map((s) => s.id)).toEqual(["s0", ...SECTIONS]);
      expect(w.shots[0].holds).toEqual([]);
      expect(w.shots[0].art).toEqual({ wide: "/world/opening/wide/manifest.json", tall: "/world/opening/tall/manifest.json" });
      expect(w.joins[0]).toEqual({ kind: "through", lengthVh: 150, params: { a: "screen" } });
      expect(joinReady(w.joins[0].kind, w.joins[0].params)).toBe(true);
      expect(w.shots.slice(1)).toEqual(plain.shots);
      expect(w.joins.slice(1)).toEqual(plain.joins);
      expect(w.joins.length).toBe(w.shots.length - 1);
    }
  });

  it("every scene lands where it did, shifted by the opening's span", () => {
    const plain = homeWorld("sunset");
    const w = realHomeWorld("sunset", { opening: true });
    expect(totalPx(w, 900) - totalPx(plain, 900)).toBeCloseTo((spanVh(w, 0) * 900) / 100);
    for (const id of SECTIONS) expect(holdPx(w, `${id}-hold`, L) - holdPx(plain, `${id}-hold`, L)).toBeCloseTo((spanVh(w, 0) * L.h) / 100);
  });

  it("at the top the opening shows s0; the through join ends in scene 1's start", () => {
    const w = realHomeWorld("sunset", { opening: true });
    expect(frameAt(w, 0, L).a.shot).toBe("s0");
    expect(frameAt(w, 0, L).hold).toBeNull();
    const start = (spanVh(w, 0) * L.h) / 100;
    expect(frameAt(w, start, L).a.shot).toBe("s1");
    expect(frameAt(w, start - 10, L).kind).toBe("through");
  });
});

describe("homeWorld", () => {
  it("has nine shots s1..s9 with holds s1-hold..s9-hold and eight valid joins, none push", () => {
    for (const sky of skies) {
      const w = homeWorld(sky);
      expect(w.shots.map((s) => s.id)).toEqual(SECTIONS);
      expect(w.joins.length).toBe(8);
      expect(totalPx(w, 900)).toBeGreaterThan(0);
      w.shots.forEach((s, i) => expect(s.holds.map((h) => h.id)).toEqual([`s${i + 1}-hold`]));
      for (const j of w.joins) {
        expect(j.kind).not.toBe("push");
        expect(joinReady(j.kind, j.params)).toBe(true);
      }
    }
  });

  it("joins are the eight in the plan, in order", () => {
    expect(homeWorld("sunset").joins.map((j) => j.kind)).toEqual(["through", "ink", "match", "curl", "match", "nightfall", "light", "light"]);
  });

  it("the joins aim at the anchors the plan names", () => {
    const j = homeWorld("sunset").joins;
    expect(j[0].params).toEqual({ a: "slate" });
    expect(j[1].params).toEqual({ a: "sketch_shell", b: "spiral" });
    expect(j[2].params).toEqual({ a: "spiral", b: "wheel" });
    expect(j[4].params).toEqual({ a: "roller", b: "map" });
    expect(j[5].params).toEqual({ lights: 12 });
    expect(j[6].params).toEqual({ a: "star", b: "lantern" });
    expect(j[7].params).toEqual({ a: "lantern_up", b: "sun" });
  });

  it("the twelve lights have a marker in the map and a star in the atlas, both variants", () => {
    const read = (url: string) => JSON.parse(readFileSync(join("public", url), "utf8"));
    const w = homeWorld("sunset");
    for (const v of ["wide", "tall"] as const) {
      const map = read(w.shots[5].art[v]);
      const atlas = read(w.shots[6].art[v]);
      for (let i = 1; i <= 12; i++) {
        expect(map.anchors[`m${i}`], `m${i} ${v}`).toBeDefined();
        expect(atlas.tags.find((t: { id: string }) => t.id === `q${i}`), `q${i} ${v}`).toBeDefined();
      }
    }
  });

  it("every anchor a join aims at is in the scene's art, at a depth something is drawn at", () => {
    const read = (url: string) => JSON.parse(readFileSync(join("public", url), "utf8"));
    for (const sky of skies) {
      const w = realHomeWorld(sky, { opening: true });
      w.joins.forEach((j, i) => {
        const sides: [string | undefined, number][] = [[j.params.a as string | undefined, i], [j.params.b as string | undefined, i + 1]];
        for (const [name, shot] of sides) {
          if (!name) continue;
          for (const v of ["wide", "tall"] as const) {
            const m = read(w.shots[shot].art[v]);
            const at = m.anchors[name];
            expect(at, `${w.shots[shot].id} ${v} ${name}`).toBeDefined();
            const depths = [...m.layers, ...m.sprites].map((d: { depth: number }) => d.depth);
            expect(depths, `${w.shots[shot].id} ${v} ${name} depth`).toContain(at.depth ?? 1);
          }
        }
      });
    }
  });

  it("every shot has art for both variants and keys from 0 to 1", () => {
    for (const sky of skies) for (const s of homeWorld(sky).shots) {
      expect(s.art.wide).toMatch(/\/manifest\.json$/);
      expect(s.art.tall).toMatch(/\/manifest\.json$/);
      expect([s.keys[0].at, s.keys[s.keys.length - 1].at]).toEqual([0, 1]);
    }
  });

  it("every shot rests at zoom 1", () => {
    for (const sky of skies) for (const s of homeWorld(sky).shots)
      expect(s.keys.every((k) => k.cam.zoom === 1 && k.cam.rot === 0), s.id).toBe(true);
  });

  it("spanVh is the shot plus its following join", () => {
    const w = homeWorld("sunset");
    expect(spanVh(w, 0)).toBe(w.shots[0].lengthVh + w.joins[0].lengthVh);
    expect(spanVh(w, 8)).toBe(w.shots[8].lengthVh);
  });

  it("the camera does not move inside any hold span, landscape and portrait", () => {
    for (const sky of skies) {
      const w = homeWorld(sky);
      for (const vp of [L, P]) {
        let start = 0;
        w.shots.forEach((s, i) => {
          const len = (s.lengthVh * vp.h) / 100;
          for (const h of s.holds) {
            const a = frameAt(w, start + Math.max(0, h.from) * len, vp);
            const b = frameAt(w, start + Math.min(1, h.to) * len, vp);
            expect(a.a.cam).toEqual(b.a.cam);
          }
          start += ((s.lengthVh + (w.joins[i]?.lengthVh ?? 0)) * vp.h) / 100;
        });
      }
    }
  });

  it("the first hold is already showing at scroll 0", () => {
    for (const sky of skies) {
      const w = homeWorld(sky);
      expect(holdPx(w, "s1-hold", L)).toBeLessThan(L.h);
      expect(frameAt(w, 0, L).holdT ?? 0).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("every panel docks on the quiet side of its scene's art", () => {
    for (const sky of skies)
      expect(homeWorld(sky).shots.map((s) => s.holds[0].dock)).toEqual(["left", "left", "right", "left", "right", "left", "right", "left", "left"]);
  });
});
