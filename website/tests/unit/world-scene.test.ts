import { describe, expect, it } from "vitest";
import { anchorPoint, placements, planOf, type LoadedScene, type ShotDraw } from "../../components/world/sceneArt";

const img = (w: number, h: number) => ({ naturalWidth: w, naturalHeight: h }) as unknown as HTMLImageElement;
const cam = (x = 0.5, y = 0.5, zoom = 1) => ({ x, y, zoom, rot: 0 });
const sprite = (id: string, depth: number, extra = {}) => ({ id, x: 100, y: 50, w: 8, h: 8, frames: 4, fps: 8, depth, mode: "loop" as const, ax: 16, ay: 0, ...extra });
const scene: LoadedScene = {
  art: {
    id: "t", variant: "wide", w: 576, h: 360,
    layers: [{ id: "sky", src: "a.png", depth: 0 }, { id: "hill", src: "b.png", depth: 0.5 }, { id: "front", src: "c.png", depth: 1 }],
    atlas: "atlas.png",
    sprites: [sprite("bird", 0.5), sprite("dog", 1)],
    anchors: {}, tags: [],
  },
  layers: [img(576, 360), img(576, 360), img(576, 360)],
  atlas: img(64, 16),
};
const view = { w: 480, h: 300 };

describe("sceneArt", () => {
  it("places layers bottom first at minus their offset, each sprite after the last layer at or below its depth", () => {
    const d = placements(scene, cam(0, 0), 0, 0, view).slice(3); // after the backdrop
    expect(d).toHaveLength(5);
    expect(d.map((x) => x.img === scene.atlas)).toEqual([false, false, true, false, true]);
    expect([d[0].dx, d[0].dy]).toEqual([-48, -30]); // depth 0: the scene centre
    expect([d[3].dx, d[3].dy]).toEqual([0, 0]); // depth 1, camera at the corner
  });

  it("draws every layer first at one offset, so a gap the parallax opens shows art, not the clear colour", () => {
    const d = placements(scene, cam(0, 0), 0, 0, view).slice(0, 3);
    expect(d.map((x) => x.img)).toEqual(scene.layers);
    expect(new Set(d.map((x) => `${x.dx},${x.dy}`))).toEqual(new Set(["-48,-30"]));
  });

  it("reads the sprite frame from the atlas and keeps every position whole", () => {
    const [bird] = placements(scene, cam(0.3, 0.6), 250, 0, view).filter((x) => x.img === scene.atlas);
    expect(bird.sx).toBe(16 + 2 * 8); // 250 ms at 8 fps is frame 2
    expect([bird.sy, bird.sw, bird.sh]).toEqual([0, 8, 8]);
    expect(Number.isInteger(bird.dx) && Number.isInteger(bird.dy)).toBe(true);
  });

  it("anchorPoint is the anchor less the layer-1 offset, or the scene centre when the name is missing", () => {
    const withAnchor = { ...scene, art: { ...scene.art, anchors: { slate: { x: 300, y: 200 } } } };
    const at = (x: number, y: number): ShotDraw => ({ scene: withAnchor, cam: cam(x, y), t: 0 });
    expect(anchorPoint(at(0, 0), "slate", view)).toEqual({ x: 300, y: 200 });
    expect(anchorPoint(at(1, 1), "slate", view)).toEqual({ x: 300 - (576 - 480), y: 200 - (360 - 300) });
    expect(anchorPoint(at(0, 0), "nope", view)).toEqual({ x: 288, y: 180 });
  });

  it("an anchor with a depth lands where a sprite of that depth lands", () => {
    const art = { ...scene.art, sprites: [sprite("pin", 0.5, { x: 300, y: 200 })], anchors: { pin: { x: 300, y: 200, depth: 0.5 } } };
    // (0.55, 0.55) not (1, 1): at the corner every depth clamps to the same offset and the test could not tell them apart
    const s: ShotDraw = { scene: { ...scene, art }, cam: cam(0.55, 0.55), t: 0 };
    const pin = placements(s.scene, s.cam, 0, 0, view).filter((x) => x.img === scene.atlas)[0];
    expect(anchorPoint(s, "pin", view)).toEqual({ x: pin.dx, y: pin.dy });
    expect(anchorPoint(s, "pin", view)).not.toEqual({ x: 300 - 77, y: 200 - 48 }); // a depth-1 reading lands elsewhere
  });

  it("planOf aims A and B at the anchors the join names", () => {
    const a: ShotDraw = { scene: { ...scene, art: { ...scene.art, anchors: { spiral: { x: 100, y: 80 } } } }, cam: cam(0, 0), t: 0 };
    const b: ShotDraw = { scene: { ...scene, art: { ...scene.art, anchors: { wheel: { x: 400, y: 250 } } } }, cam: cam(0, 0), t: 0 };
    const p = planOf(a, { kind: "match", mix: 0, params: { a: "spiral", b: "wheel" }, b }, view);
    expect([p.a.ax, p.a.ay, p.b.ax, p.b.ay]).toEqual([100, 80, 400, 250]);
    const mid = planOf(a, { kind: "match", mix: 0.5, params: { a: "spiral", b: "wheel" }, b }, view);
    expect([mid.a.dx, mid.a.dy, mid.a.z]).toEqual([240, 150, 4]); // the anchor goes to the centre of the view
  });
});
