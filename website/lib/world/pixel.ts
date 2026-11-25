type Size = { w: number; h: number };

export const variantFor = (dev: Size): "wide" | "tall" => (dev.h > dev.w ? "tall" : "wide");

const SCENE = { wide: { w: 576, h: 360 }, tall: { w: 240, h: 480 } }; // art/pixel/scene.py SIZES

/** Whole-number art pixel size in device pixels: about 480 art px across wide, 200 across tall, and never so small that the view is larger than the scene (no bars). */
export const artScale = (dev: Size): number => {
  const s = SCENE[variantFor(dev)];
  return Math.max(1, Math.round(dev.w / (dev.h > dev.w ? 200 : 480)), Math.ceil(dev.w / s.w), Math.ceil(dev.h / s.h));
};

export const viewSize = (dev: Size, k: number): Size => ({ w: Math.ceil(dev.w / k), h: Math.ceil(dev.h / k) });

// Top-left of the view in layer pixels: blends the scene centre (depth 0) with the view centred on cam * scene (depth 1), rounded, clamped to the layer; a view larger than the layer stays centred, unclamped.
export function layerOffset(cam: { x: number; y: number }, depth: number, scene: Size, view: Size): { x: number; y: number } {
  const axis = (c: number, s: number, v: number) => {
    const rest = (s - v) / 2;
    if (v > s) return Math.round(rest);
    const o = rest + depth * (c * s - v / 2 - rest);
    return Math.min(s - v, Math.max(0, Math.round(o)));
  };
  return { x: axis(cam.x, scene.w, view.w), y: axis(cam.y, scene.h, view.h) };
}

export function spriteFrame(s: { frames: number; fps: number; mode: "loop" | "scrub" }, timeMs: number, shotT: number): number {
  if (s.frames <= 1) return 0;
  if (s.mode === "scrub") return Math.min(s.frames - 1, Math.floor(Math.min(1, Math.max(0, shotT)) * s.frames));
  if (s.fps <= 0) return 0;
  return Math.floor((timeMs / 1000) * s.fps) % s.frames;
}
