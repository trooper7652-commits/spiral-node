import { FAQ, ROADMAP } from "../content";
import { FEATURES } from "../features";
import { SPECS } from "../product";
import { layerOffset } from "./pixel";
import type { Camera, SceneArt } from "./types";

type Size = { w: number; h: number };

/**
 * Where an art point sits on the screen, in CSS px from the canvas's top-left corner.
 * It reads the layer offset exactly as the renderer does (whole art pixels), so a mark stays on its art; depth is that of the layer the point sits on, 1 when unknown.
 * view: the view in art px; k: device px per art px; dpr: device px per CSS px.
 */
export function artToScreen(p: { x: number; y: number; depth?: number }, scene: Size, cam: Pick<Camera, "x" | "y">, view: Size, k: number, dpr: number) {
  const o = layerOffset(cam, p.depth ?? 1, scene, view);
  return { x: ((p.x - o.x) * k) / dpr, y: ((p.y - o.y) * k) / dpr };
}

/** The depth a tag without its own `depth` moves at: the front-most layer of the scene, 1 when it has no layers. */
export const tagDepth = (art: Pick<SceneArt, "layers">) => art.layers[art.layers.length - 1]?.depth ?? 1;

export type TagSection = "s3" | "s4" | "s6" | "s7";
export const TAG_SECTIONS: readonly string[] = ["s3", "s4", "s6", "s7"];
export type TagItem = { id: string; label: string; body: string; line?: string }; // line: a short text the tag shows beside its name (scene 3's cards)

const spec = (label: string) => SPECS.find((s) => s.label === label)!.value;
const feature = (id: string) => FEATURES.find((f) => f.id === id)!;

// Scene 4's five parts, in the words the site already has (ids as in art/pixel/site-ids.json).
const PARTS: TagItem[] = [
  { id: "screen", label: "Screen", body: feature("eink").detail },
  { id: "wheel", label: "Spiral wheel", body: feature("wheel").detail },
  { id: "keys", label: "Back and Home", body: spec("Buttons") },
  { id: "body", label: "Body", body: `${spec("Board")}. ${spec("Power")}` },
  { id: "port", label: "USB-C top", body: spec("Port") },
];

/** What each tag of a hold stands for: its name (the button's accessible name) and the text the panel shows when it is picked. Ids are those of art/pixel/site-ids.json. */
export function tagItems(section: TagSection): TagItem[] {
  switch (section) {
    case "s3":
      return FEATURES.map((f) => ({ id: f.id, label: f.title, line: f.line, body: f.detail }));
    case "s4":
      return PARTS;
    case "s6":
      return ROADMAP.map((r, i) => ({ id: `r${i + 1}`, label: r.text, body: r.done ? "Done" : "Next" }));
    case "s7":
      return FAQ.map((f, i) => ({ id: `q${i + 1}`, label: f.q, body: f.a }));
  }
}

/**
 * Scene 4's labels sit beside the art, not on it: each one is moved off its part and joined to it by a leader line.
 * SPOTS: where the label's centre may go, as art-px offsets from the tag's anchor, in the order tried (the first that is clear of the panel, the trail, the parts and the other labels wins).
 * REACH: the part's own extent round its anchor in art px (art/pixel/scenes/s4_device.py), which its label must stay clear of. The body is the whole device, so its label keeps clear of the anchor only.
 */
export const TAG_SPOTS: Record<string, [number, number][]> = {
  screen: [[80, 30], [80, -60], [-100, -60], [-100, 50]],
  wheel: [[0, 44], [110, 10], [110, -50], [-140, 40]],
  keys: [[-10, 85], [-120, 40], [-120, -30], [40, 85]],
  body: [[-60, 0], [-40, 40], [60, 40], [-60, 50]],
  port: [[-120, -5], [-120, -30], [100, -25], [-60, -45]],
};
export const TAG_REACH: Record<string, { l: number; t: number; r: number; b: number }> = {
  screen: { l: -118, t: -60, r: 26, b: 14 },
  wheel: { l: -19, t: -25, r: 31, b: 25 },
  keys: { l: -26, t: -7, r: 27, b: 7 },
  port: { l: -19, t: -7, r: 20, b: -2 },
};
