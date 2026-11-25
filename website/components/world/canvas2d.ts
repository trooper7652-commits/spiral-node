import { joinMask, OVERLAY, SHOW_B } from "../../lib/world/joins";
import { joinView, placements, planOf, sizeCanvas, type PixelRenderer, type ShotDraw } from "./sceneArt";

const canvasOf = () => document.createElement("canvas");

/** Fallback when WebGL2 is missing or lost: the same composites with drawImage (smoothing off), and the same joinMask, picked per pixel on the CPU. */
export function createPixel2d(canvas: HTMLCanvasElement): PixelRenderer {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2D context");
  // per side: the shot as drawn, then the same enlarged
  const sides = [canvasOf(), canvasOf()].map((flat) => ({ flat, zoomed: canvasOf() }));
  const sctx = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;
  let view = { w: 0, h: 0 };
  let dev = { w: 0, h: 0 };
  let lastDpr = 0;
  let lastRows: number | undefined;
  let mask = new Uint8ClampedArray(0);

  const shot = (c: CanvasRenderingContext2D, d: ShotDraw, timeMs: number) => {
    c.imageSmoothingEnabled = false; // a size change resets it
    c.fillStyle = "#000";
    c.fillRect(0, 0, view.w, view.h);
    for (const p of placements(d.scene, d.cam, timeMs, d.t, view)) c.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.sw, p.sh);
  };

  return {
    resize(d, rows) {
      const dpr = devicePixelRatio || 1;
      if (d.w === dev.w && d.h === dev.h && dpr === lastDpr && rows === lastRows) return; // browser zoom moves dpr and the CSS size, not the device size
      dev = { ...d };
      lastDpr = dpr;
      lastRows = rows;
      view = sizeCanvas(canvas, d, rows).view;
      for (const s of sides) for (const c of [s.flat, s.zoomed]) [c.width, c.height] = [view.w, view.h];
      mask = new Uint8ClampedArray(view.w * view.h * 4);
    },
    draw(timeMs, a, j) {
      if (!view.w) return;
      ctx.imageSmoothingEnabled = false;
      if (!j) return shot(ctx, a, timeMs);
      const plan = planOf(a, j, view);
      const px = [a, j.b].map((d, i) => {
        const { flat, zoomed } = sides[i];
        const z = [plan.a, plan.b][i];
        shot(sctx(flat), d, timeMs);
        const zc = sctx(zoomed);
        zc.imageSmoothingEnabled = false;
        zc.fillStyle = "#000";
        zc.fillRect(0, 0, view.w, view.h);
        zc.drawImage(flat, z.ax - z.dx / z.z, z.ay - z.dy / z.z, view.w / z.z, view.h / z.z, 0, 0, view.w, view.h);
        return zc.getImageData(0, 0, view.w, view.h).data;
      });
      joinMask(mask, view, j.kind, j.mix, joinView(a, j, view));
      const out = ctx.createImageData(view.w, view.h);
      for (let i = 0; i < out.data.length; i += 4) {
        const m = mask[i + 3];
        const src = m === OVERLAY ? mask : m === SHOW_B ? px[1] : px[0];
        out.data[i] = src[i];
        out.data[i + 1] = src[i + 1];
        out.data[i + 2] = src[i + 2];
        out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    },
    free() {},
    dispose() {},
  };
}
