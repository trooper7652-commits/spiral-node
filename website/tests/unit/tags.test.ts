import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anchorPoint, type LoadedScene } from "../../components/world/sceneArt";
import { artToScreen, tagDepth, tagItems, type TagSection } from "../../lib/world/tags";
import type { SceneArt } from "../../lib/world/types";

const site = resolve(__dirname, "../..");
const ids: Record<TagSection, string[]> = JSON.parse(readFileSync(resolve(site, "art/pixel/site-ids.json"), "utf8"));
const SECTIONS = Object.keys(ids) as TagSection[];
const SCENE_OF: Record<TagSection, string> = { s3: "shell", s4: "device", s6: "map", s7: "atlas" };

describe("tag items", () => {
  it("have the ids of art/pixel/site-ids.json, in order, with words", () => {
    expect(SECTIONS).toEqual(["s3", "s4", "s6", "s7"]);
    for (const s of SECTIONS) {
      const items = tagItems(s);
      expect(items.map((i) => i.id), s).toEqual(ids[s]);
      for (const i of items) expect(i.label.length && i.body.length, `${s} ${i.id}`).toBeGreaterThan(0);
    }
  });

  it("on the roadmap show the step as the heading and only Done or Next as the text", () => {
    for (const i of tagItems("s6")) {
      expect(["Done", "Next"], i.id).toContain(i.body);
      expect(i.body).not.toContain(i.label);
    }
  });

  it("scene 4 names the ports as on the top, and their anchor is on the device's top edge, above every other part", () => {
    expect(tagItems("s4").find((i) => i.id === "port")!.label).toBe("USB-C top");
    for (const variant of ["wide", "tall"]) {
      const file = resolve(site, `public/world/device/${variant}/manifest.json`);
      if (!existsSync(file)) continue;
      const art: SceneArt = JSON.parse(readFileSync(file, "utf8"));
      const at = (id: string) => art.tags.find((t) => t.id === id)!;
      for (const id of ["screen", "wheel", "keys", "body"]) expect(at("port").y, `${variant} ${id}`).toBeLessThan(at(id).y - 20);
    }
  });

  it("match the tags of the real scene manifests both ways", () => {
    for (const s of SECTIONS) {
      for (const variant of ["wide", "tall"]) {
        const file = resolve(site, `public/world/${SCENE_OF[s]}/${variant}/manifest.json`);
        if (!existsSync(file)) continue; // built by `python -m art.pixel.build`
        const art: SceneArt = JSON.parse(readFileSync(file, "utf8"));
        art.tags = art.tags.filter((t) => !t.id.startsWith("who")); // the figures' name tags are their own group
        expect(art.tags.map((t) => t.id).sort(), `${s} ${variant}`).toEqual([...ids[s]].sort());
        expect(tagItems(s).map((i) => i.id).sort(), `${s} ${variant}`).toEqual(art.tags.map((t) => t.id).sort());
      }
    }
  });
});

describe("artToScreen", () => {
  const img = (w: number, h: number) => ({ naturalWidth: w, naturalHeight: h }) as unknown as HTMLImageElement;
  const art: SceneArt = {
    id: "t", variant: "wide", w: 576, h: 360,
    layers: [{ id: "sky", src: "a.png", depth: 0 }, { id: "front", src: "b.png", depth: 0.5 }],
    atlas: "atlas.png", sprites: [], anchors: { pin: { x: 300, y: 200, depth: 0.5 }, flat: { x: 120, y: 90 } }, tags: [],
  };
  const scene: LoadedScene = { art, layers: [img(576, 360), img(576, 360)], atlas: img(8, 8) };
  const view = { w: 480, h: 300 };
  const cams = [{ x: 0.5, y: 0.5 }, { x: 0.55, y: 0.55 }, { x: 0.3, y: 0.7 }, { x: 0, y: 1 }].map((c) => ({ ...c, zoom: 1, rot: 0 }));

  it("is anchorPoint scaled to CSS px (k device px per art px, dpr device px per CSS px)", () => {
    for (const cam of cams) {
      for (const [name, k, dpr] of [["pin", 3, 1], ["pin", 3, 2], ["flat", 2, 1.5], ["flat", 1, 1]] as const) {
        const a = anchorPoint({ scene, cam, t: 0 }, name, view);
        const p = art.anchors[name];
        const s = artToScreen(p, art, cam, view, k, dpr);
        expect(s.x).toBeCloseTo((a.x * k) / dpr, 9);
        expect(s.y).toBeCloseTo((a.y * k) / dpr, 9);
      }
    }
  });

  it("moves with the camera by whole art pixels, and a deeper layer moves more", () => {
    const at = (depth: number, x: number) => artToScreen({ x: 300, y: 200, depth }, art, { x, y: 0.5 }, view, 3, 1).x;
    for (const x of [0.4, 0.47, 0.6]) expect(Number.isInteger(at(0.5, x) / 3)).toBe(true);
    expect(Math.abs(at(1, 0.7) - at(1, 0.4))).toBeGreaterThan(Math.abs(at(0.5, 0.7) - at(0.5, 0.4)));
    expect(at(0, 0.7)).toBe(at(0, 0.4)); // depth 0 is the scene centre
  });

  it("takes depth 1 when the point has none, and tags sit at the depth of the front layer", () => {
    const cam = cams[2];
    expect(artToScreen({ x: 300, y: 200 }, art, cam, view, 3, 1)).toEqual(artToScreen({ x: 300, y: 200, depth: 1 }, art, cam, view, 3, 1));
    expect(tagDepth(art)).toBe(0.5);
    expect(tagDepth({ layers: [] })).toBe(1);
  });
});
