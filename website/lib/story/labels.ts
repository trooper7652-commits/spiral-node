import art from "../../public/art/device.json";

// Scene 4's sketch: the device's top face (above) and front, drawn from public/art/device.json in a 600 x 470 box.
export const SKETCH = { w: 600, h: 470, top: { x: 100, y: 44 }, front: { x: 100, y: 156 } } as const;

// part: the label text; x, y: the point on the device; lx, ly: the label's centre. All are fractions of the sketch, so they scale with it.
export type Label = { part: string; x: number; y: number; lx: number; ly: number };

const { w, h, top: T, front: F } = SKETCH;
const at = (part: string, x: number, y: number, lx: number, ly: number): Label => ({ part, x: x / w, y: y / h, lx: lx / w, ly: ly / h });
const keyMid = (k: { x: number; y: number; w: number; h: number }) => [F.x + k.x + k.w / 2, F.y + k.y + k.h / 2] as const;
const [p1, p2] = art.top.usb;

export const LABELS: Label[] = [
  at("Screen", F.x + art.screen.x + art.screen.w * 0.9, F.y + art.screen.y + 24, 548, F.y + art.screen.y + 24),
  at("USB-C top", T.x + (p1.x + p2.x) / 2, T.y + art.top.usb[0].y, T.x + (p1.x + p2.x) / 2, 18),
  at("Back", ...keyMid(art.keys.back), 236, 450),
  at("Home", ...keyMid(art.keys.home), 340, 450),
  at("Spiral wheel", F.x + art.wheel.cx, F.y + art.wheel.cy + art.wheel.r, F.x + art.wheel.cx, 450),
];
