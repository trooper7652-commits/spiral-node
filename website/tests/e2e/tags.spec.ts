import { test, expect, type Page } from "@playwright/test";
import { FIGURES, whoLabel } from "../../lib/figures";
import { FEATURES } from "../../lib/features";
import { artScale, viewSize } from "../../lib/world/pixel";
import { artToScreen, tagDepth, tagItems, type TagSection } from "../../lib/world/tags";
import type { SceneArt } from "../../lib/world/types";
import { homeFrameNow, raf2, toHold } from "./world-helpers";

const SECTIONS: TagSection[] = ["s3", "s4", "s6", "s7"];
const tags = (page: Page, id: string) => page.locator(`[data-tagset="${id}"] button`);
const panel = (page: Page, id: string) => page.locator(`[data-hold="${id}-hold"] [data-panel]`);
/** A tag's accessible name: the item's name, told apart from the same words elsewhere in the page. */
const tagName = (item: { label: string }) => `${item.label} (on the picture)`;
const tag = (page: Page, id: string, item: { label: string }) => tags(page, id).and(page.getByRole("button", { name: tagName(item), exact: true }));
/** The section's own lines in the panel (what a pick replaces); the heading stays. */
const lines = (page: Page, id: TagSection) =>
  id === "s7" ? panel(page, id).locator('[data-current="true"]') : panel(page, id).getByText({ s3: "Eight choices behind the device", s4: "A sketch of the prototype", s6: "Latest from the devlog" }[id]);
const heading = (page: Page, id: string) => panel(page, id).getByRole("heading", { level: 2 });
const strip = (s: string) => s.replace(/\s+/g, "");

test.beforeEach(async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
});

/** Scrolls to the middle of a hold and waits until its tags are there. */
async function toTags(page: Page, id: TagSection, t = 0.5) {
  await page.goto("/?scene=sunset");
  await toHold(page, id, t);
  await expect(tags(page, id)).toHaveCount(tagItems(id).length);
}

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`tags at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("every tag is a button of at least 24 x 24 CSS px, named for its item", async ({ page }) => {
      test.setTimeout(120_000);
      for (const id of SECTIONS) {
        await toTags(page, id);
        for (const item of tagItems(id)) {
          const b = tag(page, id, item);
          await expect(b, `${id} ${item.id}`).toHaveCount(1);
          const box = (await b.boundingBox())!;
          expect(box.width, `${id} ${item.id} w`).toBeGreaterThanOrEqual(24);
          expect(box.height, `${id} ${item.id} h`).toBeGreaterThanOrEqual(24);
        }
      }
    });

    test("tags stay on their art points while the camera moves within the hold", async ({ page }) => {
      test.skip(vp.width < vp.height, "on a tall screen the tags are chips in the panel, not pinned");
      test.setTimeout(120_000);
      for (const id of SECTIONS) {
        await toTags(page, id, 0.35);
        for (const t of [0.35, 0.7]) {
          await toHold(page, id, t);
          await raf2(page);
          const { frame, world } = await homeFrameNow(page);
          const art: SceneArt = await page.evaluate(async (art) => {
            const url = innerHeight <= innerWidth ? art.wide : art.tall;
            return (await fetch(url)).json();
          }, world.shots.find((s) => s.id === id)!.art);
          const dpr = await page.evaluate(() => devicePixelRatio || 1);
          const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
          const k = artScale(dev);
          const view = viewSize(dev, k);
          const worst = async () => {
            let w = 0;
            for (const tag of art.tags.filter((t) => !t.id.startsWith("who"))) { // the figures' name tags are their own group
              const want = artToScreen({ x: tag.x, y: tag.y, depth: tag.depth ?? tagDepth(art) }, art, frame.a.cam, view, k, dpr);
              // scene 4's labels are beside their parts: the end of the leader line is the point
              if (id === "s4") {
                const d = (await page.locator(`[data-tagset="s4"] [data-leader="${tag.id}"] rect`).boundingBox())!;
                w = Math.max(w, Math.abs(d.x + d.width / 2 - want.x), Math.abs(d.y + d.height / 2 - want.y));
                continue;
              }
              const b = (await tags(page, id).nth(tagItems(id).findIndex((i) => i.id === tag.id)).boundingBox())!;
              // scene 3's tags are cards BESIDE their objects: the point is level with the card (within 8 px of its vertical span) rather than at its centre
              // (scene 7's question labels sit beside their stars the same way)
              if (id === "s3" || id === "s7") {
                const dy = Math.max(0, b.y - 8 - want.y, want.y - (b.y + b.height + 8));
                const dx = Math.min(Math.abs(b.x - want.x), Math.abs(want.x - b.x - b.width)); // to the nearest vertical edge
                w = Math.max(w, dy, dx > 70 ? dx : 0, want.x > b.x && want.x < b.x + b.width ? 1 : 0); // the point is not under the card
                continue;
              }
              w = Math.max(w, Math.abs(b.x + b.width / 2 - want.x), Math.abs(b.y + b.height / 2 - want.y));
            }
            return w;
          };
          await expect.poll(worst, { message: `${id} at ${t}` }).toBeLessThan(1);
        }
      }
    });

    test("the full text of every item is in the page", async ({ page }) => {
      await page.goto("/?scene=sunset");
      await expect(page.getByTestId("story")).toHaveAttribute("data-sky", /^(sunset|night)$/);
      const text = strip(await page.evaluate(() => document.body.textContent ?? ""));
      for (const id of SECTIONS)
        for (const item of tagItems(id)) {
          expect(text, `${id} ${item.id} label`).toContain(strip(item.label));
          expect(text, `${id} ${item.id} body`).toContain(strip(item.body));
        }
    });
  });
}

// Scene 4's part labels sit beside the art, each joined to its part by a leader line; none covers the part it names (or any other part).
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 640 }, { width: 960, height: 600 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  for (const sky of ["sunset", "night"]) {
    test(`scene 4 labels clear of their parts, with leader lines, at ${vp.width}x${vp.height} (${sky})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      await page.goto(`/?scene=${sky}`);
      await toHold(page, "s4");
      const items = tagItems("s4");
      await expect(tags(page, "s4")).toHaveCount(items.length);
      const { frame, world } = await homeFrameNow(page);
      const portrait = vp.height > vp.width;
      const art: SceneArt = await page.evaluate(async (a) => (await fetch(innerHeight <= innerWidth ? a.wide : a.tall)).json(), world.shots.find((s) => s.id === "s4")!.art);
      const dpr = await page.evaluate(() => devicePixelRatio || 1);
      const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
      const k = artScale(dev);
      const view = viewSize(dev, k);
      const at = Object.fromEntries(art.tags.filter((t) => !t.id.startsWith("who")).map((t) => [t.id, artToScreen({ x: t.x, y: t.y, depth: t.depth ?? tagDepth(art) }, art, frame.a.cam, view, k, dpr)]));
      const inside = (b: { x: number; y: number; width: number; height: number }, p: { x: number; y: number }) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
      const leaders = page.locator('[data-tagset="s4"] [data-leader]');
      // on a tall screen the labels are chips in the panel (off the art), so they cover nothing and need no line
      if (portrait) await expect(leaders).toHaveCount(0);
      else await expect(leaders).toHaveCount(items.length);
      for (const item of items) {
        const b = (await tag(page, "s4", item).boundingBox())!;
        for (const [id, p] of Object.entries(at)) expect(inside(b, p), `${item.id} label covers the ${id} anchor`).toBe(false);
        if (portrait) continue;
        // the leader runs from the label's edge to the part: its last point is the anchor, its first is on the label's box
        const pts = (await leaders.locator(`xpath=self::*[@data-leader="${item.id}"]`).locator("polyline").nth(1).getAttribute("points"))!.split(" ").map((q) => q.split(",").map(Number));
        expect(pts.length, `${item.id} leader has a line`).toBeGreaterThanOrEqual(2);
        const [first, last] = [pts[0], pts[pts.length - 1]];
        expect(Math.hypot(last[0] - at[item.id].x, last[1] - at[item.id].y), `${item.id} leader ends on its part`).toBeLessThanOrEqual(1);
        const near = first[0] >= b.x - 2 && first[0] <= b.x + b.width + 2 && first[1] >= b.y - 2 && first[1] <= b.y + b.height + 2;
        expect(near, `${item.id} leader starts at its label`).toBe(true);
        expect(Math.hypot(b.x + b.width / 2 - at[item.id].x, b.y + b.height / 2 - at[item.id].y), `${item.id} label is moved off its part`).toBeGreaterThan(30);
      }
    });
  }
}

test.describe("tags with a mouse and a keyboard", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("picking a tag shows its text in the panel; Escape returns the section's own text", async ({ page }) => {
    test.setTimeout(120_000);
    for (const id of SECTIONS) {
      await toTags(page, id);
      const item = tagItems(id)[1];
      await expect(lines(page, id)).toBeVisible();
      await tag(page, id, item).click();
      // the heading and bar stay; the item's label and text take the place of the section's lines
      await expect(panel(page, id).locator('[aria-live="polite"] p')).toHaveText(item.body);
      await expect(panel(page, id).locator('[aria-live="polite"] h3')).toHaveText(item.label);
      await expect(heading(page, id)).toBeVisible();
      await expect(lines(page, id)).toBeHidden();
      await expect(tag(page, id, item)).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Escape");
      await expect(lines(page, id)).toBeVisible();
      await expect(heading(page, id)).toBeVisible();
      await expect(panel(page, id).locator('[aria-live="polite"] h3')).toHaveCount(0);
    }
  });

  test("each section's group has its own name; a roadmap pick does not repeat its step", async ({ page }) => {
    test.setTimeout(120_000);
    const names = { s3: "Features on the picture", s4: "Parts on the picture", s6: "Roadmap on the picture", s7: "Questions on the picture" };
    for (const id of SECTIONS) {
      await toTags(page, id);
      await expect(page.getByRole("group", { name: names[id] })).toHaveCount(1);
    }
    await toTags(page, "s6"); // the loop above left the page at s7
    const item = tagItems("s6")[0];
    await tag(page, "s6", item).click();
    const picked = panel(page, "s6").locator('[aria-live="polite"]');
    await expect(picked.locator("h3")).toHaveText(item.label);
    await expect(picked.locator("p")).toHaveText(/^(Done|Next)$/);
  });

  test("a tag group is one tab stop: arrows move inside it, Enter and Space pick", async ({ page }) => {
    await toTags(page, "s3");
    const btns = tags(page, "s3");
    const items = tagItems("s3");
    await expect(page.locator('[data-tagset="s3"] button[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('[data-tagset="s3"] button[tabindex="-1"]')).toHaveCount(items.length - 1);

    // Tab from the element before the group lands on the one tabindex=0 tag
    await page.locator('[data-hold="s3-hold"] [data-rest]').locator("button, a[href]").last().focus();
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-tagset="s3"] button[tabindex="0"]')).toBeFocused();
    await expect(btns.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(btns.nth(1)).toBeFocused();
    await expect(btns.nth(1)).toHaveAttribute("tabindex", "0");
    await expect(btns.nth(0)).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowLeft");
    await expect(btns.nth(0)).toBeFocused();
    await page.keyboard.press("End");
    await expect(btns.nth(items.length - 1)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(btns.nth(0)).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(panel(page, "s3")).toContainText(items[1].body);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press(" ");
    await expect(panel(page, "s3")).toContainText(items[2].body);
    await expect(btns.nth(2)).toHaveAttribute("aria-pressed", "true");

    // one more Tab leaves the whole group
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-tagset]"))).toBe(false);
  });
});

test.describe("tags on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the first tap picks; a tap elsewhere clears", async ({ page }) => {
    await toTags(page, "s6");
    const item = tagItems("s6")[2];
    const b = (await tag(page, "s6", item).boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await expect(panel(page, "s6")).toContainText(item.body);
    await expect(heading(page, "s6")).toBeVisible();
    await expect(lines(page, "s6")).toBeHidden();
    await page.touchscreen.tap(4, 300); // bare art, left of every tag and above the sheet
    await expect(lines(page, "s6")).toBeVisible();
    await expect(panel(page, "s6").locator('[aria-live="polite"] h3')).toHaveCount(0);
  });
});

test.describe("scene 3 cards", () => {
  const items = tagItems("s3");
  const card = (page: Page, i: number) => tags(page, "s3").nth(i);
  const apart = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => !meet(a, b);

  test.describe("at 1440x900", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("eight cards show title and line, apart from each other, the panel and the trail; a click shows the detail", async ({ page }) => {
      test.setTimeout(120_000);
      await toTags(page, "s3");
      const p = (await panel(page, "s3").boundingBox())!;
      const trail = await page.locator("nav[data-trail]").boundingBox();
      const boxes = [];
      for (const [i, f] of FEATURES.entries()) {
        const c = card(page, i);
        await expect(c.getByText(f.title, { exact: true })).toBeVisible();
        await expect(c.getByText(f.line, { exact: true })).toBeVisible();
        const b = (await c.boundingBox())!;
        expect(b.width, `${f.id} width`).toBeLessThanOrEqual(224);
        expect(apart(b, p), `${f.id} meets the panel`).toBe(true);
        if (trail) expect(apart(b, trail), `${f.id} meets the trail`).toBe(true);
        for (const [j, o] of boxes.entries()) expect(apart(b, o), `${f.id} meets ${FEATURES[j].id}`).toBe(true);
        boxes.push(b);
      }
      // no card covers any object's art point (its own or another's)
      const { frame, world } = await homeFrameNow(page);
      const art: SceneArt = await page.evaluate(async (a) => (await fetch(a.wide)).json(), world.shots.find((s) => s.id === "s3")!.art);
      const dpr = await page.evaluate(() => devicePixelRatio || 1);
      const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
      const k = artScale(dev);
      const view = viewSize(dev, k);
      for (const t of art.tags) {
        const at = artToScreen({ x: t.x, y: t.y, depth: t.depth ?? tagDepth(art) }, art, frame.a.cam, view, k, dpr);
        boxes.forEach((b, i) => expect(at.x < b.x || at.x > b.x + b.width || at.y < b.y || at.y > b.y + b.height, `${FEATURES[i].id} covers ${t.id}`).toBe(true));
      }
      await card(page, 3).click();
      await expect(panel(page, "s3")).toContainText(FEATURES[3].detail);
    });

    test("text is at least 20 px and has contrast of at least 4.5 against the card", async ({ page }) => {
      await toTags(page, "s3");
      const r = await page.evaluate(() => {
        const lum = (c: string) => {
          const v = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((n) => { const s = +n / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        };
        return [...document.querySelectorAll('[data-tagset="s3"] button')].flatMap((b) =>
          [...b.querySelectorAll("span:not([class*=sr])")].map((s) => {
            const [a, z] = [lum(getComputedStyle(s).color), lum(getComputedStyle(b).backgroundColor)];
            return { size: parseFloat(getComputedStyle(s).fontSize), ratio: (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05) };
          }),
        );
      });
      expect(r.length).toBe(16);
      for (const x of r) { expect(x.size).toBeGreaterThanOrEqual(20); expect(x.ratio).toBeGreaterThanOrEqual(4.5); }
    });

    test("hovering a card lifts it 3 px and gives it a gold edge", async ({ page }) => {
      await toTags(page, "s3");
      const c = card(page, 2);
      await c.hover();
      await expect.poll(() => c.evaluate((e) => getComputedStyle(e).transform)).toBe("matrix(1, 0, 0, 1, 0, -3)");
      expect(await c.evaluate((e) => getComputedStyle(e).boxShadow)).toContain("rgb(233, 168, 32)");
    });
  });

  test("at 390x844 a click on a chip that peeks past the row's edge picks it at once", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await toTags(page, "s3");
    const row = (await page.locator('[data-tagset="s3"]').boundingBox())!;
    let i = -1;
    for (let n = 0; n < items.length && i < 0; n++) {
      const b = (await card(page, n).boundingBox())!;
      if (b.x < row.x + row.width - 12 && b.x + b.width > row.x + row.width) i = n;
    }
    expect(i, "a chip is cut by the row's right edge").toBeGreaterThanOrEqual(0);
    const b = (await card(page, i).boundingBox())!;
    await page.mouse.click(row.x + row.width - 8, b.y + b.height / 2);
    await expect(panel(page, "s3")).toContainText(items[i].body);
  });

  test.describe("at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("chips show titles only; the first tap shows the line", async ({ page }) => {
      await toTags(page, "s3");
      const i = 1;
      await expect(tags(page, "s3").getByText(items[i].line!, { exact: true })).toHaveCount(0);
      const b = (await card(page, i).boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await expect(card(page, i).getByText(items[i].line!, { exact: true })).toBeVisible();
      await expect(panel(page, "s3")).toContainText(items[i].body);
      // the chip with its line is whole inside the chip row, not cut at the sheet's edge
      await expect.poll(async () => {
        const [c, row] = [(await card(page, i).boundingBox())!, (await page.locator('[data-tagset="s3"]').boundingBox())!];
        return c.x >= row.x - 0.5 && c.x + c.width <= row.x + row.width + 0.5;
      }).toBe(true);
    });
  });
});

test.describe("tags with reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("a pick does not blink or transition", async ({ page }) => {
    await toTags(page, "s3");
    const btn = tags(page, "s3").nth(1);
    expect(await btn.evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0s");
    await btn.click();
    await expect(panel(page, "s3")).toContainText(tagItems("s3")[1].body);
    expect(await panel(page, "s3").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  });
});

test.describe("tags and the panel", () => {
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`no tag sits under its panel at ${vp.width}x${vp.height}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      const portrait = vp.height >= vp.width;
      for (const id of SECTIONS) {
        await toTags(page, id);
        const p = (await panel(page, id).boundingBox())!;
        for (const item of tagItems(id)) {
          const b = (await tag(page, id, item).boundingBox())!;
          const at = `${id} ${item.id} at ${Math.round(b.x)},${Math.round(b.y)}`;
          if (portrait) {
            // a chip is in the panel's row; the row scrolls sideways, so only its height is held to the panel here
            expect(b.y >= p.y && b.y + b.height <= p.y + p.height, `${at} inside the panel`).toBe(true);
            continue;
          }
          const apart = b.x + b.width <= p.x || p.x + p.width <= b.x || b.y + b.height <= p.y || p.y + p.height <= b.y;
          expect(apart, at).toBe(true);
        }
      }
    });
  }
});

test.describe("tags as chips on a tall or short screen", () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    test(`chips are one row in the panel, reachable and pickable at ${vp.width}x${vp.height}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(vp);
      for (const id of SECTIONS) {
        await toTags(page, id);
        const p = (await panel(page, id).boundingBox())!;
        const items = tagItems(id);
        const ys = new Set<number>();
        for (const item of items) ys.add(Math.round((await tag(page, id, item).boundingBox())!.y));
        expect(ys.size, `${id} one row`).toBe(1);
        const y0 = await page.evaluate(() => scrollY);
        for (const item of items) {
          const b = tag(page, id, item);
          await b.evaluate((e) => (e.parentElement as HTMLElement).scrollTo({ left: (e as HTMLElement).offsetLeft - 8 }));
          const x = (await b.boundingBox())!;
          const inside = x.x >= Math.max(0, p.x) - 0.5 && x.x + x.width <= Math.min(vp.width, p.x + p.width) + 0.5 && x.y >= p.y && x.y + x.height <= p.y + p.height && x.y + x.height <= vp.height;
          expect(inside, `${id} ${item.id} on screen in the panel`).toBe(true);
          expect(await b.evaluate((e) => getComputedStyle(e).fontSize), `${id} ${item.id} text`).toBe("20px");
        }
        // the keyboard reaches the last chip, scrolls it into view, and Enter shows its text
        const last = items[items.length - 1];
        // the chips sit under the panel's heading, before the section's rest in tab order: start from the heading
        await heading(page, id).evaluate((e) => { e.tabIndex = -1; e.focus({ preventScroll: true }); });
        await page.keyboard.press("Tab");
        await expect(tags(page, id).first()).toBeFocused();
        await page.keyboard.press("End");
        await expect(tag(page, id, last)).toBeFocused();
        const x = (await tag(page, id, last).boundingBox())!;
        expect(x.x >= 0 && x.x + x.width <= vp.width, `${id} last chip on screen after focus`).toBe(true);
        await page.keyboard.press("Enter");
        await expect(panel(page, id)).toContainText(last.body);
        expect(await page.evaluate(() => scrollY), `${id} the page did not scroll`).toBe(y0);
      }
    });
  }

  test("a resize between wide and tall moves the chips and keeps the pick", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await toTags(page, "s3");
    const item = tagItems("s3")[1];
    await tag(page, "s3", item).click();
    await expect(panel(page, "s3")).toContainText(item.body);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel(page, "s3").locator('[data-tagset="s3"]')).toHaveCount(1);
    await expect(tag(page, "s3", item)).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page, "s3")).toContainText(item.body);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel(page, "s3").locator('[data-tagset="s3"]')).toHaveCount(0);
    await expect(tag(page, "s3", item)).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("scene 7 questions", () => {
  const qs = tagItems("s7");
  const q = (page: Page, i: number) => tags(page, "s7").nth(i);
  const cut = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => !meet(a, b);

  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    test(`twelve question labels beside the stars, clear of each other, the panel and the trail at ${vp.width}x${vp.height}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      await toTags(page, "s7");
      const p = (await panel(page, "s7").boundingBox())!;
      const trail = await page.locator("nav[data-trail]").boundingBox();
      const boxes = [];
      for (const [i, it] of qs.entries()) {
        const b = q(page, i);
        await expect(b.locator("span[aria-hidden]").first(), it.id).toHaveText(it.label);
        const bb = (await b.boundingBox())!;
        expect(cut(bb, p), `${it.id} meets the panel`).toBe(true);
        if (trail) expect(cut(bb, trail), `${it.id} meets the trail`).toBe(true);
        for (const [j, o] of boxes.entries()) expect(cut(bb, o), `${it.id} meets ${qs[j].id}`).toBe(true);
        boxes.push(bb);
      }
      const r = await page.evaluate(() => {
        const lum = (c: string) => {
          const v = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((n) => { const s = +n / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        };
        return [...document.querySelectorAll('[data-tagset="s7"] button')].map((b) => {
          const s = b.querySelector("span[aria-hidden]")!;
          const [a, z] = [lum(getComputedStyle(s).color), lum(getComputedStyle(b).backgroundColor)];
          return { size: parseFloat(getComputedStyle(s).fontSize), ratio: (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05) };
        });
      });
      expect(r.length).toBe(12);
      for (const x of r) { expect(x.size).toBeGreaterThanOrEqual(20); expect(x.ratio).toBeGreaterThanOrEqual(4.5); }
    });
  }

  test("picking q3 shows its answer and a gold glow on its star", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await toTags(page, "s7");
    await expect(page.locator("[data-glow]")).toHaveCSS("opacity", "0");
    await q(page, 2).click();
    await expect(panel(page, "s7").locator('[aria-live="polite"] p')).toHaveText(qs[2].body);
    const { frame, world } = await homeFrameNow(page);
    const art: SceneArt = await page.evaluate(async (a) => (await fetch(a.wide)).json(), world.shots.find((s) => s.id === "s7")!.art);
    const dpr = await page.evaluate(() => devicePixelRatio || 1);
    const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
    const k = artScale(dev);
    const t = art.tags.find((t) => t.id === "q3")!;
    const want = artToScreen({ x: t.x, y: t.y, depth: t.depth ?? tagDepth(art) }, art, frame.a.cam, viewSize(dev, k), k, dpr);
    const g = page.locator("[data-glow]");
    await expect(g).toHaveCSS("opacity", "1");
    const b = (await g.boundingBox())!;
    expect(Math.hypot(b.x + b.width / 2 - want.x, b.y + b.height / 2 - want.y)).toBeLessThanOrEqual(8);
    expect(await g.evaluate((e) => getComputedStyle(e).boxShadow + getComputedStyle(e).borderTopColor)).toContain("rgb(233, 168, 32)");
  });

  test.describe("at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("the questions are listed in the sheet, readable; a tap shows the answer", async ({ page }) => {
      test.setTimeout(120_000);
      await toTags(page, "s7");
      for (const [i, it] of qs.entries()) {
        await expect(panel(page, "s7").locator('[data-tagset="s7"] button').nth(i)).toContainText(it.label);
        expect(await q(page, i).locator("span[aria-hidden]").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);
      }
      const b = (await q(page, 0).boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await expect(panel(page, "s7")).toContainText(qs[0].body);
    });
  });
});

// The name tags of the figures: one invisible button per figure, a paper chip with "<name>, <years>" on hover, focus or tap.
const HOLDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];
const names = (page: Page, id: string) => page.locator(`[data-names="${id}"] button`);
const chip = (page: Page) => page.locator("[data-name-chip]");
const whoOf = (id: string, who: string) => whoLabel(who === "who" ? FIGURES.find((f) => f.scene === id)!.id : who.slice(4));
const meet = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Scrolls to hold `id`; true when the scene's name tags are there (a figure under a bottom sheet has none on that screen). */
async function toNames(page: Page, id: string) {
  await page.goto("/?scene=sunset");
  await toHold(page, id, id === "s9" ? 0.25 : 0.5); // scene 9's last half meets the footer
  await raf2(page);
  return (await names(page, id).count()) > 0 && (await page.locator(`[data-names="${id}"]`).isVisible());
}

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`name tags at ${vp.width}x${vp.height}`, () => {
    const wide = vp.width > vp.height;
    test.use({ viewport: vp, hasTouch: !wide });

    test("a figure's name shows on hover (a tap on touch) and never covers the panel", async ({ page }) => {
      test.setTimeout(240_000);
      let seen = 0;
      for (const id of HOLDS) {
        if (!(await toNames(page, id))) continue;
        seen++;
        const btns = names(page, id);
        const p = (await panel(page, id).boundingBox())!;
        for (let i = 0; i < (await btns.count()); i++) {
          const b = btns.nth(i);
          const who = (await b.getAttribute("data-who"))!;
          const want = whoOf(id, who);
          await expect(b).toHaveAccessibleName(want);
          const hit = (await b.boundingBox())!;
          expect(hit.width >= 24 && hit.height >= 24, `${id} ${who} size`).toBe(true);
          if (wide) await b.hover();
          else await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
          await expect(chip(page), `${id} ${who}`).toHaveText(want);
          const c = (await chip(page).boundingBox())!;
          expect(meet(c, p), `${id} ${who} chip meets the panel`).toBe(false);
          const trail = await page.locator("nav[data-trail]").boundingBox();
          if (trail) expect(meet(c, trail), `${id} ${who} chip meets the trail`).toBe(false);
          expect(c.x >= 0 && c.y >= 0 && c.x + c.width <= vp.width && c.y + c.height <= vp.height, `${id} ${who} on screen`).toBe(true);
          if (wide) await page.mouse.move(2, vp.height / 2);
          else await page.touchscreen.tap(2, 2); // bare ground away from every figure
          await expect(chip(page)).toHaveCount(0);
        }
      }
      expect(seen, "scenes with name tags (on a tall screen most figures sit under the bottom sheet and have none)").toBeGreaterThanOrEqual(wide ? 9 : 2);
    });
  });
}

test.describe("name boxes and the things over the art", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("tags, cards and labels take their own clicks, not a figure's box", async ({ page }) => {
    test.setTimeout(120_000);
    for (const id of ["s3", "s7"] as const) {
      await toTags(page, id);
      for (const item of tagItems(id)) {
        const b = tag(page, id, item);
        const b0 = (await b.boundingBox())!;
        const at = await b.evaluate((el, [x, y]) => document.elementFromPoint(x, y)?.closest("button") === el, [b0.x + b0.width / 2, b0.y + b0.height / 2]);
        expect(at, `${id} ${item.id} centre is the tag's own, not a name box`).toBe(true);
      }
    }
  });

  test("hovering just inside the corner of Leonardo's sprite shows his chip", async ({ page }) => {
    test.setTimeout(120_000);
    expect(await toNames(page, "s2")).toBe(true);
    await raf2(page);
    const { frame, world } = await homeFrameNow(page);
    const art: SceneArt = await page.evaluate(async (a) => (await fetch(a.wide)).json(), world.shots.find((s) => s.id === "s2")!.art);
    const sp = art.sprites.find((x) => x.id === "who")!;
    const dpr = await page.evaluate(() => devicePixelRatio || 1);
    const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
    const k = artScale(dev);
    const tl = artToScreen({ x: sp.x, y: sp.y, depth: sp.depth }, art, frame.a.cam, viewSize(dev, k), k, dpr);
    await page.mouse.move(tl.x + 20, tl.y + 20);
    await expect(chip(page)).toHaveText(whoOf("s2", "who"));
  });
});

test.describe("name tags with a keyboard", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keyboard focus shows the chip, Escape hides it, and a scene's names are one tab stop", async ({ page }) => {
    test.setTimeout(240_000);
    for (const id of HOLDS) {
      expect(await toNames(page, id), id).toBe(true);
      const btns = names(page, id);
      expect(await btns.count(), id).toBe(id === "s9" ? 8 : 1);
      await expect(page.locator(`[data-names="${id}"] button[tabindex="0"]`)).toHaveCount(1);
      await btns.first().focus();
      await expect(chip(page)).toHaveText(whoOf(id, (await btns.first().getAttribute("data-who"))!));
      await page.keyboard.press("Escape");
      await expect(chip(page)).toHaveCount(0);
      if (id === "s9") {
        await page.keyboard.press("ArrowRight");
        await expect(btns.nth(1)).toBeFocused();
        await expect(chip(page)).toHaveText("Leonardo da Vinci, 1452–1519");
        await page.keyboard.press("End");
        await expect(btns.nth(7)).toBeFocused();
        await expect(chip(page)).toHaveText("Socrates, about 470–399 BC");
      }
      await page.keyboard.press("Tab"); // one Tab leaves the group
      expect(await page.evaluate(() => !!document.activeElement?.closest("[data-names]")), `${id} left the group`).toBe(false);
    }
  });

  test("tabbing through scene 9 reaches its names once", async ({ page }) => {
    expect(await toNames(page, "s9")).toBe(true);
    await panel(page, "s9").getByRole("heading", { level: 2 }).evaluate((e) => { e.tabIndex = -1; e.focus({ preventScroll: true }); });
    let inside = 0;
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => !!document.activeElement?.closest('[data-names="s9"]'))) inside++;
    }
    expect(inside).toBe(1);
  });
});
