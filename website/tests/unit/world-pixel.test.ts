import { describe, expect, it } from "vitest";
import { artScale, layerOffset, spriteFrame, variantFor, viewSize } from "../../lib/world/pixel";

describe("pixel", () => {
  it("artScale gives 3 on a 1440-wide laptop and stays whole at 125% and 150%", () => {
    expect(artScale({ w: 1440, h: 900 })).toBe(3);
    expect(artScale({ w: 1800, h: 1125 })).toBe(4);
    expect(artScale({ w: 2160, h: 1350 })).toBe(5);
    expect(artScale({ w: 1170, h: 2532 })).toBe(6);
    expect(artScale({ w: 100, h: 50 })).toBe(1);
  });

  it("artScale covers the scene: half-screen and small windows get a bigger pixel, never bars", () => {
    expect(artScale({ w: 960, h: 940 })).toBe(3);
    expect(artScale({ w: 683, h: 643 })).toBe(2);
    for (let w = 100; w <= 2600; w += 37)
      for (let h = 100; h <= 2800; h += 53) {
        const dev = { w, h };
        const v = viewSize(dev, artScale(dev));
        const s = variantFor(dev) === "wide" ? { w: 576, h: 360 } : { w: 240, h: 480 };
        expect(v.w <= s.w && v.h <= s.h, `${w}x${h}`).toBe(true);
      }
  });

  it("viewSize divides by the scale, rounding up", () => {
    expect(viewSize({ w: 1440, h: 900 }, 3)).toEqual({ w: 480, h: 300 });
    expect(viewSize({ w: 1001, h: 601 }, 4)).toEqual({ w: 251, h: 151 });
  });

  it("variantFor is tall only when taller than wide", () => {
    expect(variantFor({ w: 1440, h: 900 })).toBe("wide");
    expect(variantFor({ w: 800, h: 800 })).toBe("wide");
    expect(variantFor({ w: 1170, h: 2532 })).toBe("tall");
  });

  it("layerOffset is whole, monotonic in camera x, and never leaves the layer", () => {
    const scene = { w: 576, h: 360 };
    const view = { w: 480, h: 300 };
    for (const d of [0, 0.5, 1]) {
      let prev = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const o = layerOffset({ x: i / 200, y: 0.5 }, d, scene, view);
        expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(scene.w - view.w);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThanOrEqual(scene.h - view.h);
        expect(o.x).toBeGreaterThanOrEqual(prev);
        prev = o.x;
      }
    }
    expect(layerOffset({ x: 0, y: 0 }, 0, scene, view)).toEqual({ x: 48, y: 30 });
    expect(layerOffset({ x: 0, y: 0 }, 1, scene, view)).toEqual({ x: 0, y: 0 });
    expect(layerOffset({ x: 1, y: 1 }, 1, scene, view)).toEqual({ x: 96, y: 60 });
  });

  it("layerOffset centres without clamping when the view is larger than the scene", () => {
    expect(layerOffset({ x: 0, y: 0 }, 1, { w: 100, h: 100 }, { w: 200, h: 120 })).toEqual({ x: -50, y: -10 });
  });

  it("spriteFrame loops by time and scrubs by shot position", () => {
    expect(spriteFrame({ frames: 4, fps: 8, mode: "loop" }, 250, 0)).toBe(2);
    expect(spriteFrame({ frames: 4, fps: 8, mode: "loop" }, 750, 0)).toBe(2); // frame 6 wraps to 2
    expect(spriteFrame({ frames: 10, fps: 0, mode: "scrub" }, 9999, 0.55)).toBe(5);
    expect(spriteFrame({ frames: 10, fps: 0, mode: "scrub" }, 0, 1)).toBe(9);
    expect(spriteFrame({ frames: 10, fps: 0, mode: "scrub" }, 0, 2)).toBe(9);
    expect(spriteFrame({ frames: 10, fps: 0, mode: "scrub" }, 0, -1)).toBe(0);
    expect(spriteFrame({ frames: 1, fps: 8, mode: "loop" }, 999, 0)).toBe(0);
    expect(spriteFrame({ frames: 4, fps: 0, mode: "loop" }, 999, 0)).toBe(0);
  });
});
