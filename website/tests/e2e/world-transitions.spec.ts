import { test, expect, type Page } from "@playwright/test";
import { homeWorld } from "../../lib/world/home";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { joinPlan, lightPath } from "../../lib/world/joins";
import { layerOffset } from "../../lib/world/pixel";
import type { Camera, SceneArt } from "../../lib/world/types";
import { canvasHash, expectPalette, homeFrameNow, colourBox, inkBox, pixelsIn, pixelsOnCanvas, toJoin } from "./world-helpers";

const sunset = homeWorld("sunset", { opening: false }); // these tests start with the opening already seen (playwright.config.ts)
const MIXES = [0.2, 0.5, 0.8];
const STAR_CORE = "255,246,220"; // palette "white": the centre of each nightfall light
const art = (id: string, variant = "wide"): SceneArt => JSON.parse(readFileSync(join("public", "world", id, variant, "manifest.json"), "utf8"));
// the middle of a light join is one flat colour, which expectPalette (more than one colour) rejects: look just before it
const palMix = (i: number, m: number) => (sunset.joins[i].kind === "light" && m === 0.5 ? 0.3 : m);
const NEW_JOINS = sunset.joins.flatMap((j, i) => (["ink", "nightfall", "light"].includes(j.kind) ? [i] : []));
const open = async (page: Page, still = false) => {
  await page.goto("/?scene=sunset" + (still ? "&still" : "")); // &still pins the sprite clock, so a frame depends on the scroll alone
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
};
const noWebgl = (page: Page) =>
  page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as any;
    const get = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === "webgl2" ? null : get.call(this, type, ...rest);
    };
  });

test.describe("pixel joins", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A linear crossfade of two different scenes paints blended colours that are not in the palette, so this fails for one.
  test("a join enlarges with hard pixels", async ({ page }) => {
    await open(page);
    for (const m of [0.3, 0.5, 0.6]) {
      await toJoin(page, 0, m);
      await expectPalette(page);
    }
  });

  test("every join draws whole palette pixels, part way through", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    for (let i = 0; i < sunset.joins.length; i++)
      for (const m of MIXES) {
        await toJoin(page, i, palMix(i, m));
        await expectPalette(page);
      }
  });

  test("a join moves the picture: the middle of join 1 is not the scene at rest", async ({ page }) => {
    await open(page, true);
    await toJoin(page, 0, 0.1);
    const early = await canvasHash(page);
    await toJoin(page, 0, 0.5);
    expect(await canvasHash(page)).not.toBe(early);
  });

  test("scrolling down then up through every join returns the same frames", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, true);
    const down = new Map<string, number>();
    for (let i = 0; i < sunset.joins.length; i++)
      for (const m of MIXES) {
        await toJoin(page, i, m);
        down.set(`${i}@${m}`, await canvasHash(page));
      }
    for (let i = sunset.joins.length - 1; i >= 0; i--)
      for (const m of [...MIXES].reverse()) {
        await toJoin(page, i, m);
        expect(await canvasHash(page), `join ${i + 1} at ${m}`).toBe(down.get(`${i}@${m}`));
      }
  });
});

test.describe("pixel joins, 2D fallback", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("every kind of join stays on the palette on the 2D canvas", async ({ page }) => {
    test.setTimeout(120_000);
    await noWebgl(page);
    await open(page);
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", "2d");
    for (let i = 0; i < sunset.joins.length; i++) {
      await toJoin(page, i, palMix(i, 0.5));
      await expectPalette(page);
    }
  });
});

test.describe("pixel joins, phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("joins on the tall art stay on the palette", async ({ page }) => {
    await open(page);
    for (const i of [0, 1, 3, 5, 6, 7]) {
      await toJoin(page, i, palMix(i, 0.5));
      await expectPalette(page);
    }
  });
});

test.describe("pixel joins, new kinds", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a light is carried: at mix 0.5 of joins 7 and 8 the view is the light's colour, and the disc is small at the ends", async ({ page }) => {
    await open(page, true);
    for (const i of [6, 7]) {
      await toJoin(page, i, 0.5);
      const mid = await pixelsOnCanvas(page, []);
      expect(mid.sun, `join ${i + 1}`).toBe(mid.w * mid.h);
      await toJoin(page, i, 0.05);
      const early = await pixelsOnCanvas(page, []);
      await toJoin(page, i, 0.3);
      const grown = await pixelsOnCanvas(page, []);
      await toJoin(page, i, 0.95);
      const late = await pixelsOnCanvas(page, []);
      // the scenes carry some gold of their own, so compare with the grown disc: the ends are nearly bare
      for (const s of [early, late]) expect(grown.sun - s.sun, `join ${i + 1}`).toBeGreaterThan(grown.w * grown.h * 0.2);
    }
  });

  test("twelve lights leave the map and land on the twelve stars", async ({ page }) => {
    await open(page, true);
    const [map, atlas] = [art("map"), art("atlas")];
    for (const m of [0.2, 0.6, 0.95]) {
      await toJoin(page, 5, m);
      const { frame } = await homeFrameNow(page);
      const probe = await pixelsOnCanvas(page, []);
      const view = { w: probe.w, h: probe.h };
      const pts: [number, number][] = [];
      for (let i = 1; i <= 12; i++) {
        const an = map.anchors[`m${i}`];
        const oa = layerOffset(frame.a.cam, an.depth ?? 1, map, view);
        const tag = atlas.tags.find((t) => t.id === `q${i}`)!;
        const ob = layerOffset(frame.b!.cam, tag.depth ?? 1, atlas, view);
        const p = lightPath(i, m, { x: an.x - oa.x, y: an.y - oa.y }, { x: tag.x - ob.x, y: tag.y - ob.y });
        if (p.x >= 1 && p.y >= 1 && p.x < view.w - 1 && p.y < view.h - 1) pts.push([p.x, p.y]);
      }
      expect(pts.length, `lights in view at ${m}`).toBeGreaterThanOrEqual(10);
      const got = await pixelsOnCanvas(page, pts);
      got.at.forEach((c, i) => expect(c, `light ${i} at ${m}`).toBe(STAR_CORE));
    }
  });

  test("the hilltop rises while night falls", async ({ page }) => {
    await open(page, true);
    // the first row, down a column well inside the shadow's reach, that is grass (green) rather than sky (blue): the hill's top edge
    const hillTop = async (m: number) => {
      await toJoin(page, 5, m);
      const [col] = await pixelsIn(page, [{ x: 400, y: 0, w: 1, h: 800 }]);
      const y = col.findIndex(([r, g, b]) => g > b && g > r + 30);
      expect(y, `grass in the column at ${m}`).toBeGreaterThan(0);
      return y;
    };
    // at mix 0.2 the shadow has barely entered the view, so compare once B is mostly showing (0.55) with B at rest (0.9)
    const lifted = await hillTop(0.55);
    const rest = await hillTop(0.9);
    expect(lifted, "the hill is lower at 0.55 than at 0.9").toBeGreaterThan(rest);
  });
});

// The hand-overs line up: what is drawn at the last frame before a join's swap and at the first frame after it is the same place.
for (const [w, h, variant] of [[1440, 900, "wide"], [390, 844, "tall"]] as const) {
  test.describe(`pixel joins line up, ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    const where = (a: SceneArt, name: string, cam: Camera, view: { w: number; h: number }) => {
      const p = a.anchors[name];
      const o = layerOffset(cam, p.depth ?? 1, a, view);
      return { x: p.x - o.x, y: p.y - o.y };
    };
    /** The join's frame at mix m: its two anchors in the view and how the join draws each side there. */
    const frame = async (page: Page, i: number, m: number, a: SceneArt, b: SceneArt, an: [string, string]) => {
      await toJoin(page, i, m);
      const { frame: f } = await homeFrameNow(page);
      const { view } = (await inkBox(page, 0, 0, 0))!;
      const [pa, pb] = [where(a, an[0], f.a.cam, view), where(b, an[1], f.b!.cam, view)];
      return { view, pa, pb, plan: joinPlan(f.kind!, f.mix, view, pa, pb) };
    };
    const within = (p: { x: number; y: number }, q: { x: number; y: number }, what: string, px = 3) => {
      expect(Math.abs(p.x - q.x), `${what}: x ${p.x} vs ${q.x}`).toBeLessThanOrEqual(px);
      expect(Math.abs(p.y - q.y), `${what}: y ${p.y} vs ${q.y}`).toBeLessThanOrEqual(px);
    };

    test("join 2 to 3: the sketch's shell on the page lands on scene 3's shell, within 3 art pixels", async ({ page }) => {
      await open(page, true);
      const [A, B] = [art("desk", variant), art("shell", variant)];
      const before = await frame(page, 1, 0.49, A, B, ["sketch_shell", "spiral"]);
      const after = await frame(page, 1, 0.51, A, B, ["sketch_shell", "spiral"]);
      // the zoomed sketch's shell is drawn at (dx, dy); scene 3's shell sits where it rests
      within({ x: before.plan.a.dx, y: before.plan.a.dy }, after.pb, "the shell's anchor");
      // and in the pixels: the ink round the shell (the shell is the one big ink thing within 32 px of it) has the same centre in both frames
      const [x, y] = [after.pb.x, after.pb.y];
      const drawn = await inkBox(page, x, y, 32);
      await toJoin(page, 1, 0.49);
      const was = await inkBox(page, x, y, 32);
      expect(was!.box && drawn!.box, "ink round the shell in both frames").toBeTruthy();
      within(was!.box!, drawn!.box!, "the shell's ink");
    });

    test("join 3 to 4: the shell spiral and the device wheel meet at the swap, within 3 art pixels", async ({ page }) => {
      await open(page, true);
      const [A, B] = [art("shell", variant), art("device", variant)];
      const before = await frame(page, 2, 0.499, A, B, ["spiral", "wheel"]);
      const after = await frame(page, 2, 0.501, A, B, ["spiral", "wheel"]);
      within({ x: before.plan.a.dx, y: before.plan.a.dy }, { x: after.plan.b.dx, y: after.plan.b.dy }, "the spiral's and the wheel's centres");
      // and in the pixels: the shell's orange swirl at 0.499 and the wheel's orange/gold ring at 0.501, both searched round the same screen point, have the same centre
      const [sx, sy] = [before.plan.a.dx, before.plan.a.dy];
      await toJoin(page, 2, 0.499);
      const swirl = await colourBox(page, sx, sy, 24, [[240, 118, 46]]);
      await toJoin(page, 2, 0.501);
      const ring = await colourBox(page, sx, sy, 26, [[240, 118, 46], [233, 168, 32]]);
      expect(swirl && ring, "the swirl before and the wheel after").toBeTruthy();
      within(swirl!, ring!, "the spiral's and the wheel's centres on the canvas");
    });
  });
}

test.describe("pixel joins, reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });

  test("join images are not fetched where they are never drawn, and a join is a cut on the palette", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    await open(page);
    for (const i of [0, sunset.joins.length - 2]) {
      await toJoin(page, i, 0.3);
      await expectPalette(page);
    }
    expect(urls.filter((u) => u.includes("/world/joins/"))).toEqual([]);
  });

  test("a join is a cut: no zoom, no mix, scene A then scene B", async ({ page }) => {
    await open(page);
    const at = async (m: number) => {
      await toJoin(page, 0, m);
      return canvasHash(page);
    };
    const [a1, a2, b1, b2] = [await at(0.1), await at(0.3), await at(0.7), await at(0.9)];
    expect(a1).toBe(a2); // a moving camera or a zooming join would change the frame
    expect(b1).toBe(b2);
    expect(a1).not.toBe(b1);
  });

  test("reduced motion: each new join is one cut at its midpoint", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    for (const i of NEW_JOINS) {
      const at = async (m: number) => {
        await toJoin(page, i, m);
        return canvasHash(page);
      };
      const [a1, a2, b1, b2] = [await at(0.1), await at(0.45), await at(0.55), await at(0.9)];
      expect(a1, `join ${i + 1} before`).toBe(a2); // no light travels, no shadow crosses, nothing spreads
      expect(b1, `join ${i + 1} after`).toBe(b2);
      expect(a1, `join ${i + 1}`).not.toBe(b1);
    }
  });
});
