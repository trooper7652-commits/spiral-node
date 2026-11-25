/** x, y: the scene point (fraction 0..1) at the screen centre; zoom 1..4; rot in radians. */
export type Camera = { x: number; y: number; zoom: number; rot: number };
export type Ease = "inOut" | "out" | "linear";
/** at: position within the shot, 0..1. ease: the easing used on the way INTO this key (default "inOut"). */
export type Key = { at: number; cam: Camera; ease?: Ease };
/** from, to: positions within the shot, 0..1. dock: the side of the screen its paper panel sits on (the quiet side of the scene's art); on a tall viewport every panel is a bottom sheet. */
export type Hold = { id: string; from: number; to: number; dock: "left" | "right" | "centre" };
/** art: the pixel-art scene manifests for a wide and a tall viewport. */
export type Shot = { id: string; keys: Key[]; holds: Hold[]; lengthVh: number; art: { wide: string; tall: string } };
/** Pixel-art scene manifest at public/world/<scene-id>/<variant>/manifest.json. src and atlas are file names relative to the manifest; ax, ay: top-left of the first sprite frame in the atlas, frames run left to right. */
export type SceneArt = {
  id: string;
  variant: "wide" | "tall";
  w: number;
  h: number;
  layers: { id: string; src: string; depth: number }[];
  atlas: string;
  ink?: string; // the scene as ink lines on paper, drawn only by the `ink` join
  sprites: { id: string; x: number; y: number; w: number; h: number; frames: number; fps: number; depth: number; mode: "loop" | "scrub"; ax: number; ay: number }[];
  anchors: Record<string, { x: number; y: number; depth?: number }>; // depth: of the layer it sits on, 1 when missing
  tags: { id: string; x: number; y: number; depth?: number }[]; // depth: of the layer or sprite the tag is pinned to
};
export type TransitionKind = "through" | "match" | "curl" | "ink" | "nightfall" | "light";
/** params: `a` and `b` name the anchors (in the outgoing and the incoming scene) that a join aims at; `b` defaults to `a`. `nightfall` needs none: `lights` counts the map markers (m1..) that fly to the stars (tags q1..). */
export type Transition = { kind: TransitionKind; lengthVh: number; params: Record<string, number | string> };
/** joins[i] sits between shots[i] and shots[i + 1]. */
export type World = { shots: Shot[]; joins: Transition[] };
export type View = { shot: string; cam: Camera };
export type Frame = { a: View; b?: View; mix: number; kind: TransitionKind | null; hold: string | null; holdT?: number };
