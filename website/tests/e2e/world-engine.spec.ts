import { test, expect } from "@playwright/test";
import { canvasHash, expectPalette, lumaStd, raf2, toJoin } from "./world-helpers";

test.describe("world engine", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("paints the first shot", async ({ page }) => {
    await page.goto("/?scene=sunset");
    // data-shot is set by the first drawn frame; the screenshot-based pixel read is too slow to time under a loaded suite.
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1", { timeout: 5000 });
    await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0");
    expect(await lumaStd(page)).toBeGreaterThan(5);
  });

  test("the vh probe is as tall as the viewport", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await page.locator("[data-vh]").waitFor({ state: "attached" }); // the probe mounts with the story, after hydration
    expect(await page.evaluate(() => ({ probe: document.querySelector("[data-vh]")?.getBoundingClientRect().height, h: innerHeight }))).toEqual({ probe: 800, h: 800 });
  });

  test("resize mid-join redraws the join for the phone, on the palette", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toJoin(page, 0, 0.5);
    const wide = await canvasHash(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await toJoin(page, 0, 0.5); // the frame is a pure function of scroll and viewport: the same join, framed for the phone
    await raf2(page);
    await expectPalette(page);
    expect(await canvasHash(page)).not.toBe(wide);
  });

  test("a resize or scroll after leaving the page raises no error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?scene=sunset");
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1", { timeout: 5000 });
    await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0");

    // Client-side navigation unmounts the canvas; a resize and a scroll then must raise no error. This does not prove the listeners were removed: a leaked listener that guards against the missing element would also pass.
    await page.evaluate(() => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push("/credits"));
    await expect(page).toHaveURL(/\/credits/);
    await expect(page.locator("[data-renderer]")).toHaveCount(0);
    await page.evaluate(
      () =>
        new Promise((r) => {
          dispatchEvent(new Event("resize"));
          dispatchEvent(new Event("scroll"));
          requestAnimationFrame(() => requestAnimationFrame(() => r(null)));
        }),
    );
    expect(errors).toEqual([]);
  });

  test("context lost falls back to the 2D canvas", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1", { timeout: 5000 });
    // before the loss the canvas holds a live WebGL2 context (the attribute alone is also the default)
    expect(await page.evaluate(() => { const c = document.querySelector<HTMLCanvasElement>("canvas[data-world]")!; return { gl: !!c.getContext("webgl2"), lost: c.getContext("webgl2")!.isContextLost(), flat: c.getContext("2d") }; })).toEqual({ gl: true, lost: false, flat: null });
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", "webgl2");
    await page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas[data-world]")!.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-renderer", "2d");
    await expect(page.locator("canvas[data-world]")).toHaveCount(1);
    expect(await page.evaluate(() => !!document.querySelector<HTMLCanvasElement>("canvas[data-world]")!.getContext("2d"))).toBe(true);
    await expect.poll(() => lumaStd(page), { timeout: 5000 }).toBeGreaterThan(5);
    await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0");
  });

  test("reduced motion holds still", async ({ browser }) => {
    const run = async (reducedMotion: "reduce" | "no-preference") => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion });
      const page = await ctx.newPage();
      await page.goto("/?scene=sunset&still"); // &still: the sprites are frozen, so only the camera can change the picture
      await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1", { timeout: 5000 });
      const px = (vh: number) => (vh * 800) / 100;
      const at = async (vh: number) => {
        await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), px(vh));
        await raf2(page);
        return canvasHash(page);
      };
      const a = await at(60); // scene 1's camera rests until 144 vh and has drifted by 300 vh
      const b = await at(300);
      await ctx.close();
      return a === b;
    };
    expect(await run("reduce")).toBe(true);
    // control: the same scroll moves the camera when motion is allowed
    expect(await run("no-preference")).toBe(false);
  });
});

test.describe("@perf", () => {
  test.skip(!!process.env.CI || !process.env.PERF, "local only: set PERF=1");
  // the home page with its text
  for (const url of ["/?scene=sunset"]) test(`scrolling ${url} at 80 px per frame holds 60 fps`, async ({ playwright, baseURL }) => {
    // Headless Chromium otherwise rasterises WebGL in software (SwiftShader), which says nothing about real frame times.
    // Launch args cannot go in test.use inside a describe, so this test launches its own browser.
    const browser = await playwright.chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
    // A first visit with the opening on: a fresh context has no storage, and the motion preference is set here, not read from the OS
    // (a machine with animations turned off reports reduced motion, and the page then rightly skips the opening).
    // storageState: Playwright applies the config's (a returning visitor) to every new context, even in a browser launched here
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference", storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(url);
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s0", { timeout: 5000 });
    const { renderer, gaps } = await page.evaluate(async () => {
      const gl = document.createElement("canvas").getContext("webgl2")!;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
      const max = document.documentElement.scrollHeight - innerHeight;
      const gaps: number[] = [];
      let last = 0, y = 0;
      await new Promise<void>((done) => {
        const t0 = performance.now();
        const tick = (t: number) => {
          if (last) gaps.push(t - last);
          last = t;
          y += 80;
          scrollTo(0, y);
          // all the way down, so every join (ink, nightfall and light too) is timed; the limit only stops a runaway
          if (y < max && t - t0 < 60_000) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      return { renderer, gaps };
    });
    await browser.close();
    gaps.sort((a, b) => a - b);
    const p95 = gaps[Math.floor(gaps.length * 0.95)];
    console.log(`PERF ${url} renderer="${renderer}" frames=${gaps.length} p95=${p95.toFixed(2)}ms`);
    // 16.7 ms is one 60 Hz vsync; rAF timestamps jitter by ~0.1 ms around it, while a missed frame is >= 33 ms.
    expect(p95).toBeLessThanOrEqual(17);
  });
});
