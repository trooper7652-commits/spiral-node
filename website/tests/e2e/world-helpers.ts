import { expect, type Page } from "@playwright/test";
import { frameAt } from "../../lib/world/frame";
import { homeWorld } from "../../lib/world/home";

export type Rgb = [number, number, number];

/** The home world the page built: its sky and whether it opened with scene 0 (the page's data-sky and data-opening). Waits until both are decided. */
export async function pageWorld(page: Page) {
  const story = page.getByTestId("story");
  await expect(story).toHaveAttribute("data-sky", /^(sunset|night)$/);
  await expect(story).toHaveAttribute("data-opening", /^(true|false)$/);
  return homeWorld((await story.getAttribute("data-sky")) as "sunset" | "night", { opening: (await story.getAttribute("data-opening")) === "true" });
}

/** Scrolls the home page to position t (0..1, default the middle) of hold `<id>-hold` and waits until the canvas shows that shot; at the middle it also waits until the text is fully shown. Needs the sky to be picked, so it works on `/` as well as `/?scene=...`. */
export async function toHold(page: Page, id: string, t = 0.5) {
  const world = await pageWorld(page);
  const vh = await page.evaluate(() => document.querySelector("[data-vh]")!.getBoundingClientRect().height);
  let start = 0;
  let px = -1;
  world.shots.forEach((s, i) => {
    const h = s.holds.find((x) => x.id === `${id}-hold`);
    if (h) px = start + (h.from + t * (h.to - h.from)) * s.lengthVh * (vh / 100);
    start += (s.lengthVh + (world.joins[i]?.lengthVh ?? 0)) * (vh / 100);
  });
  expect(px, `hold ${id}-hold`).toBeGreaterThanOrEqual(0);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), px);
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", id);
  if (t === 0.5) await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1");
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

export const raf2 = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/** The home world's frame at the page's current scroll, as the canvas reports it. */
export async function homeFrameNow(page: Page) {
  const world = await pageWorld(page);
  const vp =await page.evaluate(() => ({ w: innerWidth, h: document.querySelector("[data-vh]")!.getBoundingClientRect().height }));
  return { world, vp, frame: frameAt(world, await page.evaluate(() => scrollY), vp) };
}

/** Scrolls the home page to px and waits until the canvas reports that frame (the shot, the join's kind and mix). */
export async function toPx(page: Page, px: number) {
  await page.getByTestId("story").waitFor();
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", /./);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), px);
  const { frame } = await homeFrameNow(page);
  const state = page.locator("[data-renderer]");
  await expect(state).toHaveAttribute("data-shot", frame.a.shot);
  await expect(state).toHaveAttribute("data-kind", frame.kind ?? "");
  await expect(state).toHaveAttribute("data-mix", String(Math.round(frame.mix * 1000) / 1000));
  await raf2(page);
}

/** Scrolls the home page into join `i` (0-based) at mix m, 0 < m < 1, and waits until that frame is on the canvas. */
export async function toJoin(page: Page, i: number, m: number) {
  const world = await pageWorld(page);
  const vh =await page.evaluate(() => document.querySelector("[data-vh]")!.getBoundingClientRect().height);
  let start = 0;
  for (let k = 0; k < i; k++) start += world.shots[k].lengthVh + world.joins[k].lengthVh;
  await toPx(page, ((start + world.shots[i].lengthVh + m * world.joins[i].lengthVh) * vh) / 100);
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-kind", world.joins[i].kind);
}

/** Every colour on the world canvas is in /world/palette.json, and there is more than one of them (not a blank canvas). */
export async function expectPalette(page: Page) {
  const palette: string[] = await page.evaluate(() => fetch("/world/palette.json").then((r) => r.json()));
  const colours = await canvasColours(page);
  expect(colours.filter((c) => !palette.includes(c))).toEqual([]);
  expect(colours.length).toBeGreaterThan(1);
}

/** The canvas shows palette colours only, at a whole-number enlargement from the top-left corner, with nothing blended (also as the page shows it). */
export async function expectCrisp(page: Page) {
  const canvas = page.locator("canvas[data-world]");
  const colours = await canvasColours(page);
  const palette: string[] = await page.evaluate(() => fetch("/world/palette.json").then((r) => r.json()));
  expect(colours.filter((c) => !palette.includes(c))).toEqual([]); // no blended colours at rest
  // what the screen shows, with everything but the canvas hidden: an enlargement by whole pixels adds no colour, any blend adds many
  const hide = await page.addStyleTag({ content: "body *{visibility:hidden !important} canvas[data-world]{visibility:visible !important}" });
  await raf2(page);
  const shown = await screenColours(page);
  await hide.evaluate((e) => (e as Element).remove());
  expect(shown.filter((c) => !palette.includes(c))).toEqual([]); // the palette, not this frame's colours: sprites move between the two reads
  const box = await canvas.evaluate((c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    return { kw: (r.width * devicePixelRatio) / c.width, kh: (r.height * devicePixelRatio) / c.height, left: r.left, top: r.top };
  });
  expect(Number.isInteger(Math.round(box.kw * 1000) / 1000)).toBe(true);
  expect(box.kh).toBeCloseTo(box.kw, 3); // the same whole k down the screen
  expect([box.left, box.top]).toEqual([0, 0]);
}

/** Every distinct colour of a screenshot of the page (device pixels), as "rgb(r, g, b)". */
export function screenColours(page: Page): Promise<string[]> {
  return decode(page, (d) => {
    const seen = new Set<number>();
    for (let i = 0; i < d.data.length; i += 4) seen.add((d.data[i] << 16) | (d.data[i + 1] << 8) | d.data[i + 2]);
    return [...seen].map((v) => `rgb(${v >> 16}, ${(v >> 8) & 255}, ${v & 255})`);
  });
}

/** A cheap fingerprint of the world canvas's pixels. */
export const canvasHash = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!;
    const s = document.createElement("canvas");
    s.width = c.width;
    s.height = c.height;
    const ctx = s.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    let h = 2166136261;
    for (const v of ctx.getImageData(0, 0, s.width, s.height).data) h = Math.imul(h ^ v, 16777619);
    return h >>> 0;
  });

// page.screenshot() captures WebGL without preserveDrawingBuffer; the PNG is decoded in the page, so no image library is needed.
async function decode<T>(page: Page, read: (d: ImageData, arg: any) => T, arg?: unknown): Promise<T> {
  const b64 = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ b64, src, arg }) => {
      const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return (0, eval)(`(${src})`)(ctx.getImageData(0, 0, c.width, c.height), arg);
    },
    { b64, src: read.toString(), arg },
  );
}

export function pixelsAt(page: Page, points: [number, number][]): Promise<Rgb[]> {
  return decode(page, (d, pts: [number, number][]) => pts.map(([x, y]) => { const i = (y * d.width + x) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; }), points) as Promise<Rgb[]>;
}

/** Every pixel inside each rect (CSS px, dpr 1), one list per rect. */
export function pixelsIn(page: Page, rects: { x: number; y: number; w: number; h: number }[]): Promise<Rgb[][]> {
  return decode(page, (d, rs: { x: number; y: number; w: number; h: number }[]) => rs.map((r) => {
    const out: [number, number, number][] = [];
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(d.height, Math.ceil(r.y + r.h)); y++)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(d.width, Math.ceil(r.x + r.w)); x++) {
        const i = (y * d.width + x) * 4;
        out.push([d.data[i], d.data[i + 1], d.data[i + 2]]);
      }
    return out;
  }), rects) as Promise<Rgb[][]>;
}

export async function pixelAt(page: Page, x: number, y: number): Promise<Rgb> {
  return (await pixelsAt(page, [[x, y]]))[0];
}

/** Every distinct colour of the world canvas's backing store, as "rgb(r, g, b)" (the page's own grain and panels are not in it). Needs a preserved drawing buffer. */
export function canvasColours(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!;
    const s = document.createElement("canvas");
    s.width = c.width;
    s.height = c.height;
    const ctx = s.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, s.width, s.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return [...seen].map((v) => `rgb(${v >> 16}, ${(v >> 8) & 255}, ${v & 255})`);
  });
}

/** The world canvas's size, how many of its pixels are the light's gold (255,208,106), and the colour ("r,g,b") at each point (canvas pixels). Reads the backing store. */
export function pixelsOnCanvas(page: Page, points: [number, number][]) {
  return page.evaluate((pts) => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!;
    const s = document.createElement("canvas");
    s.width = c.width;
    s.height = c.height;
    const ctx = s.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, s.width, s.height).data;
    const at = (x: number, y: number) => `${d[(y * s.width + x) * 4]},${d[(y * s.width + x) * 4 + 1]},${d[(y * s.width + x) * 4 + 2]}`;
    let sun = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 208 && d[i + 2] === 106) sun++;
    return { w: s.width, h: s.height, sun, at: pts.map(([x, y]) => at(x, y)) };
  }, points);
}

/** The world canvas's size (its view, in art pixels) and the box round the ink-coloured (28,26,20) pixels of the square of half-side r centred on (cx, cy), or null when there are none. Reads the backing store. */
export function inkBox(page: Page, cx: number, cy: number, r: number) {
  return page.evaluate(
    ([cx, cy, r]) => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!;
      const s = document.createElement("canvas");
      s.width = c.width;
      s.height = c.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, s.width, s.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = Math.max(0, Math.round(cy - r)); y < Math.min(s.height, Math.round(cy + r)); y++)
        for (let x = Math.max(0, Math.round(cx - r)); x < Math.min(s.width, Math.round(cx + r)); x++) {
          const i = (y * s.width + x) * 4;
          if (d[i] === 28 && d[i + 1] === 26 && d[i + 2] === 20) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
        }
      return { view: { w: s.width, h: s.height }, box: x1 < 0 ? null : { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 } };
    },
    [cx, cy, r],
  );
}

/** The centre of the box round the pixels of any of the given colours in the square of half-side r centred on (cx, cy) (canvas pixels), or null when there are none. Reads the backing store. */
export function colourBox(page: Page, cx: number, cy: number, r: number, colours: Rgb[]) {
  return page.evaluate(
    ([cx, cy, r, cols]) => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!;
      const s = document.createElement("canvas");
      s.width = c.width;
      s.height = c.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, s.width, s.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = Math.max(0, Math.round(cy - r)); y < Math.min(s.height, Math.round(cy + r)); y++)
        for (let x = Math.max(0, Math.round(cx - r)); x < Math.min(s.width, Math.round(cx + r)); x++) {
          const i = (y * s.width + x) * 4;
          if ((cols as Rgb[]).some((k) => d[i] === k[0] && d[i + 1] === k[1] && d[i + 2] === k[2])) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
        }
      return x1 < 0 ? null : { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 };
    },
    [cx, cy, r, colours] as [number, number, number, Rgb[]],
  );
}

/** Standard deviation of luma over the viewport: near 0 means a flat (blank) canvas. */
export function lumaStd(page: Page): Promise<number> {
  return decode(page, (d) => {
    let n = 0, sum = 0, sq = 0;
    for (let i = 0; i < d.data.length; i += 16) {
      const l = 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
      n++; sum += l; sq += l * l;
    }
    return Math.sqrt(sq / n - (sum / n) ** 2);
  });
}
