import { describe, expect, it } from "vitest";
import { FULL_MS, GHOST_MS, refreshPlan } from "../../lib/sim/refresh";

const flashes = (p: ReturnType<typeof refreshPlan>) => p.filter((s) => s.fill !== "frame").length;
const total = (p: ReturnType<typeof refreshPlan>) => p.reduce((a, s) => a + s.ms, 0);

describe("refreshPlan", () => {
  it("realism off is a plain swap with no flash and no time", () => {
    for (const full of [true, false]) {
      const p = refreshPlan(false, full, 99999);
      expect(flashes(p)).toBe(0);
      expect(total(p)).toBe(0);
    }
  });

  it("a full refresh is ink, paper, new frame in about 700 ms", () => {
    const p = refreshPlan(true, true, 99999);
    expect(p.map((s) => s.fill)).toEqual(["ink", "paper", "frame"]);
    expect(total(p)).toBe(FULL_MS);
    expect(FULL_MS).toBeGreaterThanOrEqual(600);
    expect(FULL_MS).toBeLessThanOrEqual(900);
  });

  it("a partial refresh draws the frame with a fading ghost, no flash", () => {
    const p = refreshPlan(true, false, 99999);
    expect(flashes(p)).toBe(0);
    expect(p).toEqual([{ fill: "frame", ms: GHOST_MS, ghost: true }]);
  });

  it("never flashes more than 3 times in any second, even for a stream of full requests", () => {
    const times: number[] = [];
    let last = -Infinity;
    for (let t = 0; t < 20000; t += 100) {
      const p = refreshPlan(true, true, t - last);
      if (flashes(p)) {
        last = t;
        let at = t;
        for (const s of p) {
          if (s.fill !== "frame") times.push(at);
          at += s.ms;
        }
      }
    }
    expect(times.length).toBeGreaterThan(10);
    for (const t0 of times) expect(times.filter((t) => t >= t0 && t < t0 + 1000).length).toBeLessThanOrEqual(3);
  });
});
