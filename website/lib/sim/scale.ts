import { W } from "./bits";

/** Largest integer devicePx (device pixels per screen pixel) whose CSS width fits availCssPx. */
export function screenScale(availCssPx: number, dpr: number, minDevicePx = 1) {
  const devicePx = Math.max(minDevicePx, Math.floor((availCssPx * dpr) / W));
  return { devicePx, cssWidth: (W * devicePx) / dpr };
}
