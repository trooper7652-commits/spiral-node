import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { holdPx } from "../../lib/world/frame";
import { canvasHash, expectCrisp, homeFrameNow, pageWorld, raf2, toHold } from "./world-helpers";

// A first-time visitor: no sn-opened in storage (the config's default is a returning one). The welcome popup is skipped, so its modal never takes the keys (popup.spec.ts covers it).
test.use({ storageState: { cookies: [], origins: [{ origin: `http://localhost:${process.env.E2E_PORT ?? "3111"}`, localStorage: [{ name: "sn-welcome", value: "skipped" }] }] } });

test.beforeEach(async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
});

const renderer = (page: Page) => page.locator("[data-renderer]");
const story = (page: Page) => page.getByTestId("story");
const scrollTop = (page: Page, y: number) => page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
const vhOf = (page: Page) => page.evaluate(() => document.querySelector("[data-vh]")!.getBoundingClientRect().height);

/** The page is on the nine-scene world and shows the scene its scroll position belongs to, within 1 s, never s0. */
async function expectNoOpeningAndRightScene(page: Page, expected?: string) {
  await expect(story(page)).toHaveAttribute("data-opening", "false");
  const { frame } = await homeFrameNow(page);
  expect(frame.a.shot).not.toBe("s0");
  if (expected) expect(frame.a.shot).toBe(expected);
  await expect(renderer(page)).toHaveAttribute("data-shot", frame.a.shot, { timeout: 1000 });
}

test("first visit plays it, second visit does not", async ({ page, context }) => {
  await page.goto("/?scene=sunset");
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // through it: the world is the opening's, scene 1 comes after it
  await page.getByTestId("skip-opening").click();
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  await scrollTop(page, 0);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0"); // scrolling back up still shows it on this page
  expect(await page.evaluate(() => localStorage.getItem("sn-opened"))).toBe("1");

  // (a reload of this tab keeps its world: see the reload tests below)
  const again = await context.newPage(); // a later visit in the same browser: shares localStorage, not the tab's session
  await again.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await again.goto("/?scene=sunset");
  await expect(story(again)).toHaveAttribute("data-opening", "false");
  await expect(renderer(again)).toHaveAttribute("data-shot", "s1");
});

test("scrolling past it counts as seen", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  expect(await page.evaluate(() => localStorage.getItem("sn-opened"))).toBeNull(); // sitting in it does not
  const world = await pageWorld(page);
  const vh = await vhOf(page);
  await scrollTop(page, ((world.shots[0].lengthVh + world.joins[0].lengthVh + 20) * vh) / 100);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sn-opened"))).toBe("1");
});

test("deep link skips the opening", async ({ page }) => {
  await page.goto("/?scene=sunset#community");
  await expectNoOpeningAndRightScene(page, "s8");
});

for (const [id, forgotten] of [["s3", false], ["s5", true]] as const)
  test(`a reload in scene ${id.slice(1)} keeps the world, so the same scene shows${forgotten ? " (even if the opening is not marked seen)" : ""}`, async ({ page }) => {
    await page.goto("/?scene=sunset");
    await expect(story(page)).toHaveAttribute("data-opening", "true");
    const world = await pageWorld(page);
    const y = holdPx(world, `${id}-hold`, { w: 1280, h: await vhOf(page) }); // inside the scene's hold, worked out from the world
    await scrollTop(page, y);
    await expect(renderer(page)).toHaveAttribute("data-shot", id);
    if (forgotten) await page.evaluate(() => localStorage.removeItem("sn-opened"));
    await page.reload();
    await expect(story(page)).toHaveAttribute("data-opening", "true"); // the session's world, not decided afresh
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 5); // the browser put the visitor back
    await expect(renderer(page)).toHaveAttribute("data-shot", id, { timeout: 1000 });
  });

test("a new tab in the same session decides afresh: seen, so no opening", async ({ page, context }) => {
  await page.goto("/?scene=sunset");
  await page.getByTestId("skip-opening").click();
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  const tab = await context.newPage();
  await tab.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await tab.goto("/?scene=sunset");
  await expect(story(tab)).toHaveAttribute("data-opening", "false");
});

test("Skip is a visible button, the first Tab stop of the whole page, and moves to scene 1 with focus on its heading", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const skip = page.getByTestId("skip-opening");
  await expect(skip).toBeVisible();
  await expect(skip).toHaveText("Skip");
  await page.keyboard.press("Tab"); // before the layout's skip link and the header
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  await expect(page.locator('[data-hold="s1-hold"]')).toHaveCSS("opacity", "1");
  await expect(skip).toHaveCount(0);
  const { frame } = await homeFrameNow(page);
  expect(frame.hold).toBe("s1-hold");
  // focus is not lost with the button: it is in scene 1's panel, and the view did not move
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-hold="s1-hold"]'))).toBe(true);
  const y = await page.evaluate(() => scrollY);
  await raf2(page);
  expect(await page.evaluate(() => scrollY)).toBe(y);
});

test("over the opening's paper the wordmark reads (>= 3:1) and Skip's text is at least 20 px", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await expect(story(page)).toHaveAttribute("data-light-ground", "");
  const [rgb, size] = await page.evaluate(() => {
    const w = document.querySelector("header a")!;
    return [getComputedStyle(w).color, parseFloat(getComputedStyle(document.querySelector('[data-testid="skip-opening"]')!).fontSize)] as const;
  });
  const lum = (c: number[]) => c.map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const text = rgb.match(/\d+/g)!.slice(0, 3).map(Number);
  const [a, b] = [lum(text), lum([0xf1, 0xe7, 0xcc])].sort((x, y) => y - x);
  expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(3);
  expect(size).toBeGreaterThanOrEqual(20);
});

test("Escape moves to scene 1, unless something else took the key", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.evaluate(() => addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Escape" && e.preventDefault(), true)); // a menu or popup that handled it
  await page.keyboard.press("Escape");
  await raf2(page);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
});

test("Escape moves to scene 1", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.keyboard.press("Escape");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  await expect(page.locator('[data-hold="s1-hold"]')).toHaveCSS("opacity", "1");
});

test("Escape does nothing while a dialog is open", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div role="dialog" aria-label="x"></div>'));
  await page.keyboard.press("Escape");
  await raf2(page);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
});

test("End during the opening lands on scene 9 within 1 s and s0 does not return", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.keyboard.press("End");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s9", { timeout: 1000 });
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  await page.waitForTimeout(400);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s9");
  await page.keyboard.press("Home"); // scrolling back reverses it
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
});

test("a trail jump during the opening lands on the map hold within 1 s", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.getByRole("navigation", { name: "Scenes" }).getByRole("button", { name: "Scene 6: Map" }).click();
  await expect(renderer(page)).toHaveAttribute("data-shot", "s6", { timeout: 1000 });
  await expect(page.locator('[data-hold="s6-hold"]')).toHaveCSS("opacity", "1", { timeout: 1000 });
  await expect(story(page)).toHaveAttribute("data-opening", "true");
});

test("a reload at the top of an opening page shows s0 again (it replays over nothing)", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.reload();
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
});

test("a reload of a page that had no opening has none either", async ({ page }) => {
  await page.goto("/?scene=sunset#community");
  await expectNoOpeningAndRightScene(page, "s8");
  await page.reload();
  await expectNoOpeningAndRightScene(page, "s8");
});

// Back returns to the exact place in the same world; left from the top of the opening, that place is the opening (as a reload at the top), and nothing replays over content
test("from the opening, a link to another page and back returns to the same place", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await page.locator('header nav a[href="/scripts"]').first().click();
  await page.waitForURL("**/scripts");
  await page.goBack();
  await page.waitForURL(/\/(\?.*)?$/);
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0", { timeout: 1000 });
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
});

test("a link from another page to the home page never gets the opening", async ({ page }) => {
  await page.goto("/scripts");
  await page.locator('header a[href="/"]').first().click();
  await page.waitForURL(/\/(\?.*)?$/);
  await expectNoOpeningAndRightScene(page, "s1");
});

test("every header control over the opening reads at 3:1 or better", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  const pairs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("header a, header button")]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility === "visible")
      .map((e) => {
        const cs = getComputedStyle(e);
        return { name: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30), fg: cs.color, bg: cs.backgroundColor };
      }),
  );
  expect(pairs.length).toBeGreaterThan(0);
  const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = (c: number[]) => c.slice(0, 3).map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const p of pairs) {
    const fg = rgba(p.fg);
    const bgc = rgba(p.bg);
    const bg = bgc.length < 4 || bgc[3] > 0.5 ? bgc : [0xf1, 0xe7, 0xcc]; // no ground of its own: the opening's paper
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05), p.name).toBeGreaterThanOrEqual(3);
  }
});

test.describe("as a first visit", () => {
  test.use({ reducedMotion: "no-preference" });

  test("no serious or critical axe violations on / while the opening shows", async ({ page }) => {
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto("/?scene=sunset");
    await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });

  for (const scale of [1.25, 1.5])
    test(`crisp at the top of the opening at device scale ${scale}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale, reducedMotion: "no-preference", storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      await page.goto("/?scene=sunset");
      await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
      await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0");
      await expectCrisp(page);
      await context.close();
    });

  test("on a phone Skip is on screen, clear of the trail bar", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "no-preference", storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/?scene=sunset");
    await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
    const trailBox = page.getByRole("navigation", { name: "Scenes" });
    const skip = (await page.getByTestId("skip-opening").boundingBox())!;
    const trail = (await trailBox.boundingBox())!;
    expect(skip.x).toBeGreaterThanOrEqual(0);
    expect(skip.x + skip.width).toBeLessThanOrEqual(390);
    expect(skip.y).toBeGreaterThanOrEqual(0);
    expect(skip.y + skip.height).toBeLessThanOrEqual(trail.y); // above the bar
    expect(await page.locator("[data-hold]").evaluateAll((els) => els.filter((e) => Number(getComputedStyle(e).opacity) > 0).length)).toBe(0); // no panel under it at s0
    await expect(trailBox.locator("[data-trail-chip]")).toHaveText("START");
    await context.close();
  });
});

test("scrolling back up reverses it", async ({ page }) => {
  await page.goto("/?scene=sunset&still"); // &still pins the sprite clock: only the scroll changes the picture
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0");
  const top = await canvasHash(page);
  const world = await pageWorld(page);
  await scrollTop(page, (world.shots[0].lengthVh * (await vhOf(page))) / 200); // the middle of s0: the screen is part way on
  await expect.poll(() => canvasHash(page)).not.toBe(top);
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  await scrollTop(page, 0);
  await expect.poll(() => canvasHash(page)).toBe(top);
});

test("the trail meter shows nine waypoints, none current during s0, and START", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  const nav = page.getByRole("navigation", { name: "Scenes" });
  await expect(nav.getByRole("button")).toHaveCount(9);
  await expect(nav.locator('button[aria-current="step"]')).toHaveCount(0);
  await expect(nav.locator("[data-trail-chip]")).toHaveText("START");
  await page.getByTestId("skip-opening").click();
  await expect(nav.locator('button[aria-current="step"]')).toHaveCount(1);
  await expect(nav.getByRole("button", { name: "Scene 1: Countryside" })).toHaveAttribute("aria-current", "step");
  await expect(nav.locator("[data-trail-chip]")).toHaveText("1/9 COUNTRYSIDE");
});

test("the first screen stays at or under 600 KB", async ({ page }) => {
  const sizes: Promise<number>[] = [];
  const urls: string[] = [];
  let failed = 0;
  page.on("response", (r) => {
    urls.push(r.url());
    sizes.push(r.request().sizes().then((s) => s.responseBodySize + s.responseHeadersSize, () => (failed++, 0)));
  });
  await page.goto("/?scene=sunset");
  await expect(page.locator("canvas[data-world]")).not.toHaveAttribute("data-draws", "0"); // the first picture is on the canvas
  await expect(renderer(page)).toHaveAttribute("data-shot", "s0");
  const total = (await Promise.all(sizes)).reduce((a, b) => a + b, 0);
  expect(urls.some((u) => u.includes("/world/opening/"))).toBe(true); // s0's art is part of it
  expect(failed, "a size that could not be read would count as 0").toBe(0);
  expect(total).toBeLessThanOrEqual(600e3);
});

test("blocked storage never throws: the opening plays and Skip works", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  await page.goto("/?scene=sunset");
  await expect(story(page)).toHaveAttribute("data-opening", "true");
  await page.getByTestId("skip-opening").click();
  await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
  expect(errors).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("there is no opening: scene 1 at the top", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await expect(story(page)).toHaveAttribute("data-opening", "false");
    await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
    await expect(page.getByTestId("skip-opening")).toHaveCount(0);
  });
});

// Back to the home page after a first visit (the opening's world has "manual" scroll restoration, which must not leak to other pages)
test.describe("Back after a first visit keeps the place", () => {
  const links = {
    s5: (page: Page) => page.locator('section[data-scene="s5"]').getByRole("link", { name: "See more scripts" }),
    s9: (page: Page) => page.locator('section[data-scene="s9"]').getByTestId("explore-path").getByRole("link").nth(1),
  };
  for (const id of ["s5", "s9"] as const)
    test(`Back to / from scene ${id.slice(1)} lands on the same scene within 1 s, its panel shown`, async ({ page }) => {
      await page.goto("/?scene=sunset");
      await expect(story(page)).toHaveAttribute("data-opening", "true");
      await toHold(page, id);
      const y = await page.evaluate(() => scrollY);
      await links[id](page).click();
      await expect(page).toHaveURL(/\/scripts$/);
      await page.goBack();
      await expect(story(page)).toHaveAttribute("data-opening", "true"); // the same world, spacer and all
      await expect(renderer(page)).toHaveAttribute("data-shot", id, { timeout: 1000 });
      await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1", { timeout: 1000 });
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(4);
    });

  test("Back between two other pages after the opening keeps its place", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?scene=sunset");
    await page.getByTestId("skip-opening").click();
    await expect(renderer(page)).toHaveAttribute("data-shot", "s1");
    await page.locator('header nav a[href="/scripts"]').first().click();
    await expect(page).toHaveURL(/\/scripts$/);
    expect(await page.evaluate(() => history.scrollRestoration)).toBe("auto");
    // as far down as the page goes (up to 1500), then follow a link without Playwright's scroll-into-view moving the page first
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThan(300);
    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('main a[href^="/scripts/"]')!.click());
    await expect(page).toHaveURL(/\/scripts\/[^/]+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/scripts$/);
    await expect.poll(() => page.evaluate((y) => Math.abs(scrollY - y), y)).toBeLessThan(50);
  });

  test("the header logo from another page after the opening gives no opening, scene 1", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await page.getByTestId("skip-opening").click();
    await page.locator('header nav a[href="/scripts"]').first().click();
    await expect(page).toHaveURL(/\/scripts$/);
    await page.locator('header a[href="/"]').first().click();
    await expectNoOpeningAndRightScene(page, "s1");
  });

  test("/#community from another page after the opening lands on that scene", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await page.getByTestId("skip-opening").click();
    await page.locator('header nav a[href="/scripts"]').first().click();
    await expect(page).toHaveURL(/\/scripts$/);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Community" }).click();
    await expect(page).toHaveURL(/\/#community$/);
    await expectNoOpeningAndRightScene(page, "s8");
  });

  test("with reduced motion the page never takes scroll restoration over", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/?scene=sunset");
    await expect(story(page)).toHaveAttribute("data-opening", "false");
    expect(await page.evaluate(() => history.scrollRestoration)).toBe("auto");
    await context.close();
  });
});
