import { expect, test, type Page } from "@playwright/test";
import { expectCrisp, expectPalette } from "./world-helpers";

const canvas = (page: Page) => page.locator("canvas[data-world]");
const draws = async (page: Page) => Number(await canvas(page).getAttribute("data-draws"));

/** The first frame of scene 1 is on the canvas. */
async function drawn(page: Page) {
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  await expect(canvas(page)).not.toHaveAttribute("data-draws", "0");
}

/** A cheap fingerprint of the canvas's pixels. */
const hash = (page: Page) =>
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

test("a half-screen window shows no bars: the canvas holds palette colours only", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 940 });
  await page.goto("/?scene=sunset");
  await drawn(page);
  await expectPalette(page);
});

const SIZES = [1, 1.25, 1.5, 2].map((s) => [1440, 900, s]).concat([[1366, 768, 1]]);
for (const [w, h, scale] of SIZES)
  test(`crisp at every device scale (${w}x${h} at ${scale})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto("/?scene=sunset");
    await drawn(page);
    await expectCrisp(page);
    await context.close();
  });

test("scene 1 moves while idle", async ({ browser }) => {
  const run = async (reducedMotion: "reduce" | "no-preference") => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
    const page = await context.newPage();
    await page.goto("/?scene=sunset");
    await drawn(page);
    const a = await hash(page);
    await page.waitForTimeout(600);
    const b = await hash(page);
    await context.close();
    return a === b;
  };
  expect(await run("no-preference")).toBe(false);
  expect(await run("reduce")).toBe(true);
});

test("loop pauses when hidden", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await drawn(page);
  const hidden = (on: boolean) =>
    page.evaluate((on) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => on });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
      document.dispatchEvent(new Event("visibilitychange"));
    }, on);
  await expect.poll(() => draws(page)).toBeGreaterThan(2); // running
  const clock = async () => Number(await page.locator("[data-renderer]").getAttribute("data-time"));
  await hidden(true);
  await page.waitForTimeout(150); // a frame already in flight may still land
  const stopped = await draws(page);
  const before = await clock();
  await page.waitForTimeout(500);
  expect(await draws(page)).toBe(stopped);
  await hidden(false);
  await expect.poll(() => draws(page)).toBeGreaterThan(stopped);
  // the world clock carries on from where it stopped: the 500 ms hidden gap is not in it, so no sprite frame jumps
  expect((await clock()) - before).toBeLessThan(200);
});

test("no WebGL2 falls back to the 2D canvas with the same crisp result", async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as any;
    const get = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === "webgl2" ? null : get.call(this, type, ...rest);
    };
  });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", "2d");
  await drawn(page);
  await expectCrisp(page);
});
