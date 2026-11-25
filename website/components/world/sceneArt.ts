import { joinPlan, type JoinView, type Sheet } from "../../lib/world/joins";
import { artScale, layerOffset, spriteFrame, viewSize } from "../../lib/world/pixel";
import type { Camera, SceneArt, Transition } from "../../lib/world/types";

type Size = { w: number; h: number };
export type LoadedScene = { art: SceneArt; layers: HTMLImageElement[]; atlas: HTMLImageElement; ink?: Sheet };
/** One textured rectangle: a source rect of img, drawn with its top-left at (dx, dy) in view pixels. */
export type Draw = { img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number };
/** A scene at a camera; t: progress through its shot, 0..1 (for scrubbed sprites). */
export type ShotDraw = { scene: LoadedScene; cam: Camera; t: number };
/** A join in progress: A is the shot drawn first, `b` the one it hands over to. */
export type JoinDraw = { kind: Transition["kind"]; mix: number; params: Transition["params"]; b: ShotDraw };
export type PixelRenderer = {
  /** rows: a band of that many art rows at the scale `dev` gives, instead of the whole screen. */
  resize(dev: Size, rows?: number): void;
  /** One frame: the shot at rest, or (with `join`) the join between it and `join.b`. Whole palette pixels only. */
  draw(timeMs: number, a: ShotDraw, join?: JoinDraw): void;
  dispose(): void;
  /** Lets go of the GPU copies of a scene's images. */
  free(scene: LoadedScene): void;
};

const TRIES = 3;
async function retry<T>(f: () => Promise<T>): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await f();
    } catch (e) {
      if (n >= TRIES) throw e;
      await new Promise((r) => setTimeout(r, 300 * n));
    }
  }
}
const image = (src: string) =>
  retry(async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  });

/** Loads a manifest and its images (named relative to the manifest). Each request is tried 3 times. */
export async function loadScene(url: string): Promise<LoadedScene> {
  const art = await retry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return (await r.json()) as SceneArt;
  });
  const rel = (f: string) => new URL(f, new URL(url, location.href)).href;
  const [layers, atlas, ink] = await Promise.all([
    Promise.all(art.layers.map((l) => image(rel(l.src)))),
    image(rel(art.atlas)),
    art.ink ? sheet(rel(art.ink)).catch(() => undefined) : undefined, // without it the ink join cuts straight to the scene
  ]);
  return { art, layers, atlas, ink };
}

async function sheet(src: string): Promise<Sheet> {
  const img = await image(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
}

/** The draws of one shot, bottom first: layers in manifest order; a sprite follows the last layer at or below its depth. */
export function placements(scene: LoadedScene, cam: Camera, timeMs: number, shotT: number, view: Size): Draw[] {
  const { art } = scene;
  const out: Draw[] = [];
  const sprite = (s: SceneArt["sprites"][number]): Draw => {
    const o = layerOffset(cam, s.depth, art, view);
    const f = spriteFrame(s, timeMs, shotT);
    return { img: scene.atlas, sx: s.ax + f * s.w, sy: s.ay, sw: s.w, sh: s.h, dx: Math.round(s.x) - o.x, dy: Math.round(s.y) - o.y };
  };
  // The layers only add up to a solid picture when they sit at one offset (rest); at any other camera each depth shifts differently and opens gaps. So first every layer aligned at the depth-0 offset, as a backdrop the shifted layers cover; a gap shows that, never the clear colour.
  const o0 = layerOffset(cam, 0, art, view);
  for (const img of scene.layers) out.push({ img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, dx: 0 - o0.x, dy: 0 - o0.y });
  const after = art.sprites.map((s) => Math.max(0, art.layers.map((l) => l.depth <= s.depth).lastIndexOf(true)));
  art.layers.forEach((l, i) => {
    const img = scene.layers[i];
    const o = layerOffset(cam, l.depth, art, view);
    out.push({ img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, dx: 0 - o.x, dy: 0 - o.y });
    art.sprites.forEach((s, j) => after[j] === i && out.push(sprite(s)));
  });
  if (art.layers.length === 0) art.sprites.forEach((s) => out.push(sprite(s)));
  return out;
}

/** Where a named anchor sits in the view (art pixels); a scene without it gives its centre. */
export function anchorPoint(s: ShotDraw, name: string, view: Size) {
  const { art } = s.scene;
  const p: { x: number; y: number; depth?: number } = art.anchors[name] ?? { x: art.w / 2, y: art.h / 2 };
  const o = layerOffset(s.cam, p.depth ?? 1, art, view);
  return { x: p.x - o.x, y: p.y - o.y };
}

/** Where a tag sits in the view (art pixels), or null when the scene has none by that id. */
function tagPoint(s: ShotDraw, id: string, view: Size) {
  const t = s.scene.art.tags.find((x) => x.id === id);
  if (!t) return null;
  const o = layerOffset(s.cam, t.depth ?? 1, s.scene.art, view);
  return { x: t.x - o.x, y: t.y - o.y };
}

/** What the join's mask reads this frame (see joinMask): the anchors, B's ink image with its corner, and where each light starts and ends. */
export function joinView(a: ShotDraw, j: JoinDraw, view: Size): JoinView {
  const name = (k: string) => String(j.params[k] ?? j.params.a ?? "");
  const art = j.b.scene.art;
  const o = layerOffset(j.b.cam, art.anchors[name("b")]?.depth ?? 1, art, view); // the ink sits at its anchor's depth, so its spiral is under the anchor
  const lights: JoinView["lights"] = [];
  for (let i = 1; i <= Number(j.params.lights ?? 0); i++) {
    const from = a.scene.art.anchors[`m${i}`] && anchorPoint(a, `m${i}`, view);
    const to = tagPoint(j.b, `q${i}`, view);
    if (from && to) lights.push({ from, to });
  }
  return { pa: anchorPoint(a, name("a"), view), pb: anchorPoint(j.b, name("b"), view), ink: j.b.scene.ink ?? null, inkAt: { x: -o.x, y: -o.y }, lights };
}

/** The mask's cache key: everything joinMask reads. */
export const joinKey = (j: JoinDraw, v: JoinView) => [j.kind, j.mix, v.pa.x, v.pa.y, v.pb.x, v.pb.y, v.inkAt.x, v.inkAt.y, v.ink ? 1 : 0, ...v.lights.flatMap((l) => [l.from.x, l.from.y, l.to.x, l.to.y])].join("|");

/** How each side of a join is zoomed this frame (see joinPlan), aimed at the anchors the join's params name. */
export function planOf(a: ShotDraw, j: JoinDraw, view: Size) {
  const name = (k: string) => String(j.params[k] ?? j.params.a ?? "");
  return joinPlan(j.kind, j.mix, view, anchorPoint(a, name("a"), view), anchorPoint(j.b, name("b"), view));
}

/** Backing store = the view; CSS size = view x k device pixels, so the browser's pixelated upscale is a whole-number one. */
export function sizeCanvas(canvas: HTMLCanvasElement, dev: Size, rows?: number): { k: number; view: Size } {
  const k = artScale(dev);
  const view = viewSize(dev, k);
  if (rows) view.h = rows; // a band: the scale of the whole screen, a fixed number of art rows
  if (canvas.width !== view.w) canvas.width = view.w;
  if (canvas.height !== view.h) canvas.height = view.h;
  const dpr = devicePixelRatio || 1;
  canvas.style.width = `${(view.w * k) / dpr}px`;
  canvas.style.height = `${(view.h * k) / dpr}px`;
  return { k, view };
}
