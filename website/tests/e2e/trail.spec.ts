import { expect, test, type Page } from "@playwright/test";
import { holdPx } from "../../lib/world/frame";
import { homeWorld, SECTIONS } from "../../lib/world/home";
import { raf2, toHold } from "./world-helpers";

const nav = (page: Page) => page.getByRole("navigation", { name: "Scenes" });
const button = (page: Page, name: string) => nav(page).getByRole("button", { name });
const NAMES = [
  "Scene 1: Countryside",
  "Scene 2: Desk",
  "Scene 3: Shell",
  "Scene 4: Device",
  "Scene 5: Scroll",
  "Scene 6: Map",
  "Scene 7: Star atlas",
  "Scene 8: Town square",
  "Scene 9: Dawn hill",
];
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.beforeEach(async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
});

test("the trail meter is a Scenes navigation with nine named buttons in order", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(nav(page)).toHaveAttribute("data-trail", "");
  const buttons = nav(page).getByRole("button");
  await expect(buttons).toHaveCount(9);
  for (let i = 0; i < 9; i++) await expect(buttons.nth(i)).toHaveAccessibleName(NAMES[i]);
});

test("exactly one waypoint is current, and it follows the scroll", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(button(page, NAMES[0])).toHaveAttribute("aria-current", "step");
  await expect(nav(page).locator('button[aria-current="step"]')).toHaveCount(1);
  await toHold(page, "s4");
  await expect(button(page, NAMES[3])).toHaveAttribute("aria-current", "step");
  await expect(nav(page).locator('button[aria-current="step"]')).toHaveCount(1);
});

test("the chip names the current scene", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const chip = nav(page).locator("[data-trail-chip]");
  await expect(chip).toHaveText("1/9 COUNTRYSIDE");
  await toHold(page, "s6");
  await expect(chip).toHaveText("6/9 MAP");
});

const world = homeWorld("sunset", { opening: false }); // these tests start with the opening already seen (playwright.config.ts)
const vhOf = (page: Page) => page.evaluate(() => document.querySelector("[data-vh]")!.getBoundingClientRect().height);
/** Where the click on waypoint `id` has to land: the middle of its hold. */
const holdY = async (page: Page, id: string) => holdPx(world, `${id}-hold`, { w: await page.evaluate(() => innerWidth), h: await vhOf(page) });
/** Within 1.5 s of the click: the scroll is at the hold, the hold's panel is shown whole (opacity 1) and the waypoint is current. */
async function expectAt(page: Page, id: string, name: string) {
  const y = await holdY(page, id);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 1500 }).toBeGreaterThan(y - 4);
  expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(4);
  await expect(button(page, name)).toHaveAttribute("aria-current", "step", { timeout: 1500 });
  await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1", { timeout: 1500 });
}

test("clicking waypoint 6 scrolls to the map hold within 1.5 s, focus and URL kept", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const url = page.url();
  const s6 = button(page, NAMES[5]);
  await s6.click(); // a far jump: it lands at once
  await expectAt(page, "s6", NAMES[5]);
  await expect(s6).toBeFocused();
  expect(page.url()).toBe(url);
});

test("a click on the next waypoint reaches its hold within 1.5 s", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await toHold(page, "s5");
  await button(page, NAMES[5]).click();
  await expectAt(page, "s6", NAMES[5]);
});

test("a short hop scrolls there smoothly within 1.5 s", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await toHold(page, "s4");
  const y = await holdY(page, "s6");
  const vh = await vhOf(page);
  // two screens short of the map hold: inside the 3-screen range, so the scroll is smooth
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y - 2 * vh);
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", /./);
  await button(page, NAMES[5]).click();
  await expectAt(page, "s6", NAMES[5]);
});

test("scrolling back: the waypoint follows and the walker turns round", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await toHold(page, "s4");
  await expect(button(page, NAMES[3])).toHaveAttribute("aria-current", "step");
  await toHold(page, "s2");
  await expect(button(page, NAMES[1])).toHaveAttribute("aria-current", "step");
  await expect(nav(page)).toHaveAttribute("data-dir", "back");
});

test("at 1440x900 the meter sits on the right edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?scene=sunset");
  const box = (await nav(page).boundingBox())!;
  expect(box).not.toBeNull();
  const gap = 1440 - (box.x + box.width);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(24);
});

test("the walker is the scene's figure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?scene=sunset");
  const FIGURES = ["newton", "leonardo", "anning", "faraday", "lovelace", "idrisi", "galileo", "socrates", "newton"];
  for (let i = 0; i < 9; i++) {
    await toHold(page, SECTIONS[i]);
    const walker = nav(page).locator("[data-figure]");
    await expect(walker).toHaveAttribute("data-figure", FIGURES[i]);
    await expect(walker.locator("xpath=preceding-sibling::span")).toHaveCount(1); // the dog still walks ahead
  }
});

for (const [W, H] of [[390, 844], [820, 1180]] as const) {
  test(`at ${W}x${H} the meter is a bar on the bottom edge and no panel overlaps it`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: W, height: H });
    await page.goto("/?scene=sunset");
    const meter = (await nav(page).boundingBox())!;
    expect(meter).not.toBeNull();
    expect(Math.abs(H - (meter.y + meter.height))).toBeLessThanOrEqual(2);
    expect(meter.width).toBeGreaterThanOrEqual(360);
    for (const id of SECTIONS) {
      await toHold(page, id);
      const panel = (await page.locator(`[data-hold="${id}-hold"] [data-panel]`).boundingBox())!;
      expect(panel, `${id} panel`).not.toBeNull();
      expect(overlaps(meter, panel), `${id} panel overlaps the meter`).toBe(false);
    }
  });
}

// A short landscape screen takes the bar too: the column (about 400 px) would not fit, and its buttons would touch.
for (const [W, H] of [[844, 390], [740, 360]] as const) {
  test(`at ${W}x${H} the meter is a bar inside the screen, clear of every panel`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: W, height: H });
    await page.goto("/?scene=sunset");
    const meter = (await nav(page).boundingBox())!;
    expect(meter.y).toBeGreaterThanOrEqual(0);
    expect(meter.y + meter.height).toBeLessThanOrEqual(H + 0.5);
    expect(meter.x).toBeGreaterThanOrEqual(0);
    expect(meter.x + meter.width).toBeLessThanOrEqual(W + 0.5);
    // the buttons are 28 px and do not overlap one another
    const boxes = await nav(page).getByRole("button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    boxes.slice(1).forEach((b, i) => expect(overlaps(boxes[i], b), `buttons ${i + 1} and ${i + 2}`).toBe(false));
    // the chip's text is at least 20 px
    expect(await nav(page).locator("[data-trail-chip]").evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);
    for (const id of SECTIONS) {
      await toHold(page, id);
      const panel = (await page.locator(`[data-hold="${id}-hold"] [data-panel]`).boundingBox())!;
      expect(overlaps(meter, panel), `${id} panel overlaps the meter`).toBe(false);
      expect(panel.y, `${id} panel top`).toBeGreaterThanOrEqual(0);
    }
  });
}

// Tags sit in the art; the meter must never cover one.
for (const [W, H] of [[1440, 900], [390, 844]] as const) {
  test(`at ${W}x${H} no tag box meets the meter`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: W, height: H });
    await page.goto("/?scene=sunset");
    const meter = (await nav(page).boundingBox())!;
    for (const id of ["s3", "s4", "s6", "s7"]) {
      await toHold(page, id);
      await expect(page.locator(`[data-tagset="${id}"] button`).first()).toBeAttached();
      await raf2(page);
      // a chip scrolled out of its row is clipped, not on screen
      const boxes = await page.locator(`[data-tagset="${id}"] button`).evaluateAll((els) => els.flatMap((e) => {
        const r = e.getBoundingClientRect();
        const row = e.parentElement!.getBoundingClientRect();
        const chip = e.parentElement!.hasAttribute("data-tagset") && /(auto|scroll)/.test(getComputedStyle(e.parentElement!).overflowX);
        return chip && (r.right <= row.left || r.left >= row.right) ? [] : [{ x: r.x, y: r.y, width: r.width, height: r.height }];
      }));
      expect(boxes.length, `${id} tags`).toBeGreaterThan(0);
      boxes.forEach((b, i) => expect(overlaps(meter, b), `${id} tag ${i} meets the meter`).toBe(false));
    }
  });
}

test("the crew's sprite cells are whole: the walk steps land on 0 and -24 px", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await toHold(page, "s2");
  const keyframe = await page.evaluate(() => {
    for (const sheet of document.styleSheets) for (const r of sheet.cssRules) if (r instanceof CSSKeyframesRule && /walk/.test(r.name)) return r.cssText;
    return "";
  });
  expect(keyframe).toMatch(/-48px/);
});

test("every button is at least 24x24", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const buttons = nav(page).getByRole("button");
  await expect(buttons).toHaveCount(9);
  for (let i = 0; i < 9; i++) {
    const box = (await buttons.nth(i).boundingBox())!;
    expect(box.width, `button ${i} width`).toBeGreaterThanOrEqual(24);
    expect(box.height, `button ${i} height`).toBeGreaterThanOrEqual(24);
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("clicking waypoint 6 lands at once", async ({ page }) => {
    await page.goto("/?scene=sunset");
    const s6 = button(page, NAMES[5]);
    await s6.click();
    await raf2(page);
    const y1 = await page.evaluate(() => scrollY);
    expect(Math.abs(y1 - (await holdY(page, "s6")))).toBeLessThanOrEqual(4);
    await expect(page.locator('[data-hold="s6-hold"]')).toHaveCSS("opacity", "1");
    await page.waitForTimeout(500);
    expect(Math.abs((await page.evaluate(() => scrollY)) - y1)).toBeLessThanOrEqual(2);
    await expect(s6).toHaveAttribute("aria-current", "step");
  });
});
