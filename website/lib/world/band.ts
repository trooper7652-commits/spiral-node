import type { Camera } from "./types";

export type BandScene = "countryside" | "desk" | "device" | "scroll" | "map" | "square";

/** Art rows in a page band. */
export const BAND_ROWS = 180;

const SCENE_H = 360; // art/pixel/scene.py SIZES, wide

/**
 * Per scene: its wide manifest, and the strip of it the band shows. `top` is the art row of the scene's main layer (`depth`) at the top of the band;
 * `x` is the scene column (0..1) in the middle of it. Each strip holds the scene's figure and what it does (windmill, screen, fountain, map).
 * Countryside is the sunset sky: it is the same every visit, and warm next to the paper.
 */
export const BANDS: Record<BandScene, { url: string; x: number; top: number; depth: number }> = {
  countryside: { url: "/world/countryside-sunset/wide/manifest.json", x: 0.53, top: 100, depth: 0.8 },
  desk: { url: "/world/desk/wide/manifest.json", x: 0.53, top: 100, depth: 0.8 },
  device: { url: "/world/device/wide/manifest.json", x: 0.56, top: 95, depth: 0.9 },
  scroll: { url: "/world/scroll/wide/manifest.json", x: 0.5, top: 100, depth: 0.9 },
  map: { url: "/world/map/wide/manifest.json", x: 0.5, top: 130, depth: 0.5 },
  square: { url: "/world/square/wide/manifest.json", x: 0.62, top: 120, depth: 0.8 },
};

/** The fixed camera of a band: inverts layerOffset so the main layer's top row lands on `top` (the other layers follow by their depth). */
export function bandCam(scene: BandScene, rows = BAND_ROWS): Camera {
  const { x, top, depth } = BANDS[scene];
  const rest = (SCENE_H - rows) / 2;
  return { x, y: ((top - rest) / depth + rows / 2 + rest) / SCENE_H, zoom: 1, rot: 0 };
}
