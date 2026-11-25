import { test, expect, type Page } from "@playwright/test";
import { frameAt, holdPx, totalPx } from "../../lib/world/frame";
import { homeWorld, SECTIONS } from "../../lib/world/home";
import { toHold, toPx } from "./world-helpers";

const world = homeWorld("sunset", { opening: false }); // these tests start with the opening already seen (playwright.config.ts)
const holds = world.shots.flatMap((s) => s.holds.map((h) => h.id));
const vpOf = (page: Page) => page.evaluate(() => ({ w: innerWidth, h: document.querySelector("[data-vh]")!.getBoundingClientRect().height }));

/** Counts, per hold, the times its panel gains the class `blink`. Read with `blinks`. */
const trackBlinks = (page: Page) =>
  page.evaluate(() => {
    const seen: Record<string, number> = ((window as unknown as { __blinks: Record<string, number> }).__blinks = {});
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        const hold = el.closest("[data-hold]")?.getAttribute("data-hold");
        if (hold && el.hasAttribute("data-panel") && el.classList.contains("blink") && !(m.oldValue ?? "").split(" ").includes("blink")) seen[hold] = (seen[hold] ?? 0) + 1;
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
const blinks = (page: Page, id: string) => page.evaluate((id) => (window as unknown as { __blinks: Record<string, number> }).__blinks[id] ?? 0, id);

test.describe("panels at 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a hold is one paper panel no bigger than a third of the screen, docked on its side", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/?scene=sunset");
    for (const [i, id] of SECTIONS.entries()) {
      await toHold(page, id);
      const panel = page.locator(`[data-hold="${id}-hold"] [data-panel]`);
      await expect(panel).toHaveCount(1);
      await expect(panel).toContainText(`SCENE ${i + 1}`);
      const b = (await panel.boundingBox())!;
      expect(b.width * b.height, id).toBeLessThanOrEqual((1440 * 900) / 3);
      const dock = world.shots[i].holds[0].dock;
      if (dock === "left") expect(b.x + b.width / 2, id).toBeLessThan(720);
      if (dock === "right") expect(b.x + b.width / 2, id).toBeGreaterThan(720);
      // body text is at least 20 px
      expect(await panel.locator("p").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), id).toBeGreaterThanOrEqual(20);
    }
    // what is not in the panel is still in the page, out of sight
    await toHold(page, "s3");
    await expect(page.locator('[data-hold="s3-hold"] [data-rest]')).toHaveCSS("clip-path", /inset/);
    await expect(page.locator('[data-hold="s3-hold"] [data-rest]').getByRole("button")).toHaveCount(8);
  });
});

test.describe("panels on a tall screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every panel is a bottom sheet above the trail bar's strip", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/?scene=sunset");
    for (const id of SECTIONS) {
      await toHold(page, id);
      const b = (await page.locator(`[data-hold="${id}-hold"] [data-panel]`).boundingBox())!;
      expect(b.x, `${id} left`).toBeGreaterThanOrEqual(15.5);
      expect(b.x + b.width, `${id} right`).toBeLessThanOrEqual(390 - 15.5);
      expect(b.y + b.height, `${id} bottom`).toBeLessThanOrEqual(844 - 72 + 0.5);
      expect(b.y, `${id} top`).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("panel blink", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the panel that becomes live blinks once, and no other panel does", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s1");
    await trackBlinks(page);
    // into the start of s2's hold (where its panel is still fading in), then on to where it is whole
    await toHold(page, "s2", 0.02);
    await toHold(page, "s2");
    await expect(page.locator('[data-hold="s2-hold"]')).toHaveCSS("opacity", "1");
    await expect.poll(() => blinks(page, "s2-hold")).toBe(1);
    await page.waitForTimeout(1200);
    expect(await blinks(page, "s2-hold")).toBe(1);
    // nothing else blinked: not s1's panel going dark, not the seven that were never on screen
    expect(await page.evaluate(() => Object.keys((window as unknown as { __blinks: Record<string, number> }).__blinks))).toEqual(["s2-hold"]);
  });

  test("picking a tag blinks the live panel once, under the same throttle", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s3");
    await expect(page.locator('[data-tags="s3"] button').first()).toBeAttached();
    await page.waitForTimeout(1100); // the blink for arriving is spent
    await trackBlinks(page);
    await page.locator('[data-tags="s3"] button').nth(1).click();
    await expect.poll(() => blinks(page, "s3-hold")).toBe(1);
    await page.locator('[data-tags="s3"] button').nth(2).click(); // inside the throttle window: no second blink
    await page.waitForTimeout(700);
    expect(await blinks(page, "s3-hold")).toBe(1);
    expect(await page.evaluate(() => Object.keys((window as unknown as { __blinks: Record<string, number> }).__blinks))).toEqual(["s3-hold"]);
  });

  test("a fast scroll never blinks a panel more than once a second", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s1");
    await trackBlinks(page);
    const vp = await vpOf(page);
    const ys = ["s2", "s3", "s2", "s3", "s2"].map((id) => holdPx(world, `${id}-hold`, vp));
    // five scene changes in half a second
    await page.evaluate(async (ys) => {
      for (const y of ys) {
        scrollTo({ top: y, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 100));
      }
    }, ys);
    await page.waitForTimeout(700);
    const counts = await page.evaluate(() => Object.values((window as unknown as { __blinks: Record<string, number> }).__blinks));
    expect(Math.max(...counts)).toBeLessThanOrEqual(1);
    expect(await blinks(page, "s2-hold")).toBe(1);
  });
});

test.describe("links in a live hold", () => {
  for (const [W, H] of [[1280, 800], [390, 844]] as const) {
    test(`a link in the scene 9 hold takes a click at ${W}x${H}`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await page.goto("/?scene=sunset");
      await toHold(page, "s9");
      const s9 = page.locator('[data-hold="s9-hold"]');
      // the hit test sees the link itself, not a layer over it
      await s9.getByRole("link", { name: "Join the launch list" }).click({ trial: true });
      await s9.getByRole("link", { name: "★ Star on GitHub" }).click({ trial: true });
      // on a wide screen the signs hang over the art, outside the hold; on a phone they are in the panel
      await page.getByTestId("explore-path").nth(1).getByRole("link").click();
      await expect(page).toHaveURL(/\/scripts$/);
    });
  }

  // the bottom sheet (390x844, 360x640) puts the overlay above the strip; the wide screen docks it on the panel
  for (const [W, H] of [[1280, 800], [390, 844], [360, 640]] as const) {
    test(`Tab into the hidden flow brings it up, whole on screen and focused at ${W}x${H}`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await page.goto("/?scene=sunset");
      await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
      const first = page.locator('[data-hold="s3-hold"] [data-rest] button').first();
      for (let i = 0; i < 60 && !(await first.evaluate((a) => a === document.activeElement)); i++) await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
      await expect(first).toBeInViewport({ ratio: 1 });
      const b = (await first.boundingBox())!;
      expect(b.width).toBeGreaterThan(8);
      expect(b.height).toBeGreaterThan(8);
      const rest = page.locator('[data-hold="s3-hold"] [data-rest]');
      await expect(rest).toHaveCSS("clip-path", "none");
      // the whole overlay is on screen, above the 72 px strip on a tall screen
      const o = (await rest.boundingBox())!;
      expect(o.y, "overlay top").toBeGreaterThanOrEqual(0);
      expect(o.y + o.height, "overlay bottom").toBeLessThanOrEqual(H - (H >= W ? 72 : 0) + 0.5);
      // focus on paper: a gold ring with an ink ring outside it
      const ring = await first.evaluate((e) => { const c = getComputedStyle(e); return { outline: c.outlineColor, width: c.outlineWidth, shadow: c.boxShadow }; });
      expect(ring.outline).toBe("rgb(233, 168, 32)");
      expect(ring.width).toBe("2px");
      expect(ring.shadow).toContain("rgb(28, 26, 20)");
    });
  }

  test("Tab walks the holds in reading order, and whatever it lands on in a panel is on screen", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?scene=sunset");
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
    const withFocusables = await page.locator("[data-hold]").evaluateAll((els) => els.filter((e) => e.querySelector("a[href], button")).map((e) => e.getAttribute("data-hold")));
    expect(withFocusables.length).toBeGreaterThan(3);
    const seen: string[] = [];
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press("Tab");
      const at = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const b = a?.getBoundingClientRect();
        return {
          hold: a?.closest("[data-hold]")?.getAttribute("data-hold") ?? null,
          rest: !!a?.closest("[data-rest]"),
          text: a?.textContent ?? "",
          whole: !!b && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth,
        };
      });
      if (!at.hold) continue;
      if (seen[seen.length - 1] !== at.hold) seen.push(at.hold);
      if (!at.rest) expect(at.whole, `"${at.text}" is on screen`).toBe(true);
      if (at.hold === "s9-hold" && /Star on GitHub/.test(at.text)) break;
    }
    expect(seen).toEqual(withFocusables);
  });
});

test.describe("while a scene loads", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the text follows the scroll and the canvas stays hidden until its first picture", async ({ page }) => {
    await page.route("**/world/**", async (r) => {
      await new Promise((done) => setTimeout(done, 3000));
      await r.continue().catch(() => {});
    });
    await page.goto("/?scene=sunset");
    await expect(page.getByTestId("story")).toHaveAttribute("data-sky", "sunset");
    const canvas = page.locator("canvas[data-world]");
    await expect(canvas).toHaveCSS("visibility", "hidden");
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), holdPx(world, "s5-hold", await vpOf(page)));
    await expect(page.locator('[data-hold="s5-hold"]')).toHaveCSS("opacity", "1", { timeout: 1500 });
    // and it is scene 5's text that shows, not another's
    await expect(page.locator('[data-hold="s5-hold"] [data-panel]')).toContainText("SCENE 5");
    await expect(page.locator('[data-hold="s5-hold"] h2')).toBeVisible();
    await expect(canvas).toHaveCSS("visibility", "hidden");
    await expect(canvas).toHaveCSS("visibility", "visible", { timeout: 15_000 });
  });
});

for (const [W, H] of [[1280, 800], [390, 844]]) test.describe(`world text ${W}x${H}`, () => {
  test.use({ viewport: { width: W, height: H } });

  test("text is hidden while the camera moves", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/?scene=sunset");
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
    await expect(page.locator("[data-live]")).toHaveCount(1);
    const vp = await vpOf(page);
    const total = totalPx(world, vp.h);
    for (let px = 0; px <= total; px += 160) {
      if (frameAt(world, px, vp).hold) continue;
      await toPx(page, px);
      const ops = await page.locator("[data-hold]").evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
      expect(Math.max(...ops), "at " + px).toBeLessThanOrEqual(0.05);
    }
  });

  test("reading order", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
    expect(await page.locator("[data-hold]").evaluateAll((els) => els.map((e) => e.getAttribute("data-hold")))).toEqual(holds);
  });
});

test.describe("world text, no JS", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });

  test("all text renders in flow", async ({ page }) => {
    await page.goto("/?scene=sunset");
    const secs = page.locator("[data-hold]");
    await expect(secs).toHaveCount(holds.length);
    const boxes: { y: number; h: number }[] = [];
    for (let i = 0; i < holds.length; i++) {
      const s = secs.nth(i);
      await expect(s).toHaveCSS("opacity", "1");
      await expect(s).toHaveCSS("position", "static");
      const b = (await s.boundingBox())!;
      boxes.push({ y: b.y, h: b.height });
    }
    boxes.slice(1).forEach((b, i) => expect(b.y).toBeGreaterThanOrEqual(boxes[i].y + boxes[i].h - 1));
  });
});
