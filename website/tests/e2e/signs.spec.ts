import { test, expect, type Page } from "@playwright/test";
import { artScale, viewSize } from "../../lib/world/pixel";
import { artToScreen } from "../../lib/world/tags";
import type { SceneArt } from "../../lib/world/types";
import { homeFrameNow, raf2, toHold } from "./world-helpers";

const PATHS = [
  { href: "/spiral-node", title: "The device", line: "What it is, what it is made of, and the launch list." },
  { href: "/scripts", title: "Scripts", line: "Small loops, one thought at a time." },
  { href: "/today", title: "Today", line: "Today's fact and question." },
  { href: "/write", title: "Write your own", line: "Write your own script." },
  { href: "/design", title: "Design explorations", line: "Shapes and colours being tried." },
];

const signs = (page: Page) => page.getByTestId("explore-path");
const caption = (page: Page) => page.getByTestId("sign-caption");

test.beforeEach(async ({ page }) => {
  await page.route("**/app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
});

/** Scrolls to the middle of scene 9's hold and waits until the signs are pinned to the art. */
async function toSigns(page: Page) {
  await page.goto("/?scene=sunset");
  await toHold(page, "s9");
  await expect(page.locator("ul[data-pinned]")).toHaveCount(1);
}

/** scale and translateY of a computed `matrix(...)` or `matrix3d(...)`. */
const motion = (css: string) => {
  const v = css.slice(css.indexOf("(") + 1, -1).split(",").map(Number);
  return css.startsWith("matrix3d") ? { scale: v[0], ty: v[13] } : { scale: Math.hypot(v[0], v[1]), ty: v[5] };
};

test.describe("hanging signs", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("five signs are links to the five paths", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s9");
    await expect(signs(page)).toHaveCount(5);
    const hrefs = await signs(page).evaluateAll((els) => els.map((e) => e.querySelector("a")?.getAttribute("href")));
    expect(hrefs).toEqual(PATHS.map((p) => p.href));
  });

  test("hover or focus lifts, grows and glows a sign and shows its caption", async ({ page }) => {
    await toSigns(page);
    await expect(caption(page)).toHaveText("");
    for (const [how, n] of [["hover", 1], ["focus", 3]] as const) {
      if (how === "hover") await signs(page).nth(n).hover();
      else await signs(page).nth(n).locator("a").focus();
      const sign = signs(page).nth(n);
      await expect(sign).toHaveAttribute("data-active", "true");
      await expect(caption(page)).toContainText(PATHS[n].title);
      await expect(caption(page)).toContainText(PATHS[n].line);
      // the title stands on its own line above the line
      const [t, l] = await caption(page).evaluate((e) => [e.querySelector("strong")!.getBoundingClientRect().bottom, e.querySelector("span")!.getBoundingClientRect().top]);
      expect(l).toBeGreaterThanOrEqual(t);
      // the lift is stepped: wait for the end of the transition
      await expect.poll(async () => motion(await sign.evaluate((e) => getComputedStyle(e).transform)), { message: `${how} lift` }).toEqual({ scale: expect.closeTo(1.08, 2), ty: expect.closeTo(-6, 1) });
      expect(await sign.evaluate((e) => getComputedStyle(e).boxShadow)).toContain("rgb(233, 168, 32)");
      for (let i = 0; i < 5; i++) if (i !== n) await expect(signs(page).nth(i)).toHaveAttribute("data-aside", i < n ? "left" : "right");
    }
  });


  test("signs face the visitor at rest", async ({ page }) => {
    await toSigns(page);
    for (const sign of await signs(page).all()) {
      const transform = await sign.evaluate((e) => getComputedStyle(e).transform);
      expect(transform).toMatch(/^(matrix\(1, 0, 0, 1, 0, 0\)|none)$/);
      const title = await sign.locator("span").first().evaluate((e) => ({
        width: e.getBoundingClientRect().width,
        fontSize: parseFloat(getComputedStyle(e).fontSize),
      }));
      expect(title.width).toBeGreaterThanOrEqual(20);
      expect(title.fontSize).toBeGreaterThanOrEqual(20);
    }
  });

  test("the active sign grows and glows, the others step aside", async ({ page }) => {
    await toSigns(page);
    const centres = await signs(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2));
    await signs(page).nth(2).hover();
    await page.waitForTimeout(400);
    const sign2 = signs(page).nth(2);
    const m = motion(await sign2.evaluate((e) => getComputedStyle(e).transform));
    expect(m.scale).toBeGreaterThanOrEqual(1.05);
    expect(m.scale).toBeLessThanOrEqual(1.12);
    expect(await sign2.evaluate((e) => getComputedStyle(e).boxShadow)).toContain("rgb(233, 168, 32)");
    const newCentres = await signs(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2));
    for (let i = 0; i < 2; i++) expect(newCentres[i] - centres[i]).toBeLessThanOrEqual(-8);
    for (let i = 3; i < 5; i++) expect(newCentres[i] - centres[i]).toBeGreaterThanOrEqual(8);
    for (const sign of await signs(page).all()) {
      const transform = await sign.evaluate((e) => getComputedStyle(e).transform);
      expect(transform).not.toContain("matrix3d");
    }
  });

  test("the active sign bursts: gold lines leave its border in steps, the others stay still", async ({ page }) => {
    await toSigns(page);
    const after = (n: number) => signs(page).nth(n).evaluate((e) => {
      const c = getComputedStyle(e, "::after");
      return { content: c.content, image: c.backgroundImage, name: c.animationName, timing: c.animationTimingFunction };
    });
    expect((await after(1)).content).toBe("none");
    await signs(page).nth(1).hover();
    await expect(signs(page).nth(1)).toHaveAttribute("data-active", "true");
    const a = await after(1);
    expect(a.content).not.toBe("none");
    expect(a.image).toContain("rgb(233, 168, 32)");
    expect(a.name).toContain("sign-burst");
    expect(a.timing).toContain("steps");
    for (const i of [0, 2, 3, 4]) expect((await after(i)).content).toBe("none");
    // focus bursts too
    await signs(page).nth(3).locator("a").focus();
    await expect(signs(page).nth(3)).toHaveAttribute("data-active", "true");
    expect((await after(3)).content).not.toBe("none");
  });

  test("all five fit between the panel and the trail meter", async ({ page }) => {
    await toSigns(page);
    const panel = (await page.locator('[data-hold="s9-hold"] [data-panel]').boundingBox())!;
    const trail = (await page.locator("nav[data-trail]").boundingBox())!;
    const boxes = await signs(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    for (const box of boxes) {
      expect(box.x + box.width).toBeLessThanOrEqual(trail.x);
      expect(box.x).toBeGreaterThanOrEqual(panel.x + panel.width);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const b1 = boxes[i], b2 = boxes[j];
        const overlap = !(b1.x + b1.width <= b2.x || b2.x + b2.width <= b1.x || b1.y + b1.height <= b2.y || b2.y + b2.height <= b1.y);
        expect(overlap, `sign ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  test("keyboard: focus survives the pin flipping, and Enter opens the sign", async ({ page }) => {
    await toSigns(page);
    await signs(page).nth(3).locator("a").focus();
    const href = () => page.evaluate(() => document.activeElement?.getAttribute("href"));
    const row = page.locator("ul[data-pinned]").locator("xpath=..");
    await toHold(page, "s8"); // out of the hold: while focus is on a sign the row stays where it is and fades with its hold
    const y = await page.evaluate(() => scrollY);
    await raf2(page);
    expect(await href()).toBe("/write");
    await expect(row).toHaveCSS("opacity", "0");
    expect(Math.abs((await page.evaluate(() => scrollY)) - y), "focus did not scroll the page").toBeLessThanOrEqual(2);
    await toHold(page, "s9");
    await expect(row).toHaveCount(1);
    await expect(row).toHaveCSS("opacity", "1");
    expect(await href()).toBe("/write");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/write$/);
  });

  test("every sign link is at least 24 x 24 CSS px", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s9");
    for (const a of await signs(page).locator("a").all()) {
      const b = (await a.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(24);
      expect(b.height).toBeGreaterThanOrEqual(24);
    }
  });

  test("reduced motion: no transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?scene=sunset");
    await toHold(page, "s9");
    const d = await signs(page).first().evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(d.split(",").every((x) => parseFloat(x) === 0)).toBe(true);
    await signs(page).first().hover();
    await expect(signs(page).first()).toHaveAttribute("data-active", "true");
    const burst = await signs(page).first().evaluate((e) => { const c = getComputedStyle(e, "::after"); return { content: c.content, name: c.animationName }; });
    expect(burst.content).not.toBe("none"); // the lines are there, still
    expect(burst.name).toBe("none");
  });
});

for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test.describe(`pinned signs stay clear at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("the row spans the drawn beam from post to post and no CSS beam is drawn", async ({ page }) => {
      await toSigns(page);
      await raf2(page);
      const { frame, world } = await homeFrameNow(page);
      const art: SceneArt = await page.evaluate(async (a) => (await fetch(innerHeight <= innerWidth ? a.wide : a.tall)).json(), world.shots.find((s) => s.id === "s9")!.art);
      const dpr = await page.evaluate(() => devicePixelRatio || 1);
      const dev = await page.evaluate((d) => ({ w: Math.ceil(innerWidth * d), h: Math.ceil(innerHeight * d) }), dpr);
      const k = artScale(dev);
      const view = viewSize(dev, k);
      const at = (n: "beam_l" | "beam_r") => artToScreen(art.anchors[n], art, frame.a.cam, view, k, dpr);
      const l = at("beam_l");
      const r = at("beam_r");
      const row = page.locator("ul[data-pinned]").locator("xpath=..");
      await expect.poll(async () => (await row.boundingBox())!.x).toBeCloseTo(l.x, 0);
      const b = (await row.boundingBox())!;
      expect(b.x + b.width).toBeCloseTo(r.x, 0);
      expect(b.y).toBeCloseTo(l.y, 0);
      for (const [i, li] of (await signs(page).all()).entries()) {
        const s = (await li.boundingBox())!;
        expect(s.x, `sign ${i} right of the left post`).toBeGreaterThanOrEqual(l.x - 1);
        expect(s.x + s.width, `sign ${i} left of the right post`).toBeLessThanOrEqual(r.x + 1);
      }
      await expect(page.locator("[data-beam]:visible")).toHaveCount(0);
    });

    test("every sign link is on screen and clear of the trail meter and the panel, at rest and hovered", async ({ page }) => {
      await toSigns(page);
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const trail = await box("nav[data-trail]");
      const panel = await box('[data-hold="s9-hold"] [data-panel]');
      const clear = (b: { x: number; y: number; width: number; height: number }, o: typeof trail) =>
        b.x + b.width <= o.x || o.x + o.width <= b.x || b.y + b.height <= o.y || o.y + o.height <= b.y;
      const check = async (what: string) => {
        for (const [i, a] of (await signs(page).locator("a").all()).entries()) {
          const b = (await a.boundingBox())!;
          expect(b.x, `${what} ${i} left`).toBeGreaterThanOrEqual(0);
          expect(b.y, `${what} ${i} top`).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width, `${what} ${i} right`).toBeLessThanOrEqual(vp.width);
          expect(b.y + b.height, `${what} ${i} bottom`).toBeLessThanOrEqual(vp.height);
          expect(clear(b, trail), `${what} ${i} clear of the trail`).toBe(true);
          expect(clear(b, panel), `${what} ${i} clear of the panel`).toBe(true);
        }
      };
      await check("rest");
      for (const n of [0, 4]) {
        await signs(page).nth(n).hover();
        await expect(signs(page).nth(n)).toHaveAttribute("data-active", "true");
        await page.waitForTimeout(450); // the transition is three steps of 0.3 s
        await check(`hover ${n}`);
      }
    });
  });
}

for (const vp of [{ width: 844, height: 390 }, { width: 740, height: 360 }]) {
  test.describe(`short landscape ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("in every hold no panel control is covered, and no panel meets the visible header", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/?scene=sunset");
      for (const id of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]) {
        await toHold(page, id);
        const bad = await page.evaluate((id) => {
          const panel = document.querySelector(`[data-hold="${id}-hold"] [data-panel]`)!;
          const pr = panel.getBoundingClientRect();
          const out: string[] = [];
          // everything of the header that shows: the band itself, and the collapsed spiral button (a toggle for the links, outside the header)
          for (const el of document.querySelectorAll("header, button[aria-controls='site-nav']")) {
            const cs = getComputedStyle(el);
            const hr = el.getBoundingClientRect();
            const shown = cs.visibility !== "hidden" && +cs.opacity > 0 && hr.height > 0 && hr.width > 0;
            if (shown && hr.bottom > pr.top && hr.top < pr.bottom && hr.right > pr.left && hr.left < pr.right) out.push(`${el.tagName} meets the panel`);
          }
          for (const el of panel.querySelectorAll<HTMLElement>("a, button")) {
            const r = el.getBoundingClientRect();
            if (r.width < 10 || r.height < 10) continue; // visually hidden
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue; // off the screen: reached by scrolling
            // a chip scrolled out of its row is reached by scrolling the row, not covered
            let clipped = false;
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              if (!/(auto|scroll)/.test(getComputedStyle(a).overflowX)) continue;
              const ar = a.getBoundingClientRect();
              if (cx < ar.left || cx > ar.right) clipped = true;
            }
            if (clipped) continue;
            const hit = document.elementFromPoint(cx, cy);
            if (!hit || !el.contains(hit)) out.push(`${(el.textContent ?? "").trim().slice(0, 20)} is covered by ${hit?.tagName}`);
          }
          return out;
        }, id);
        expect(bad, id).toEqual([]);
      }
    });
  });
}

test.describe("hanging signs on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every sign link is at least 24 x 24 CSS px", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s9");
    for (const a of await signs(page).locator("a").all()) {
      const b = (await a.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(24);
      expect(b.height).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe("hanging signs on a touch screen", () => {
  test("the first tap selects and the second opens; a tap elsewhere clears", async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
    await toSigns(page);
    const url = page.url();
    await signs(page).nth(2).tap();
    await expect(signs(page).nth(2)).toHaveAttribute("data-active", "true");
    expect(page.url()).toBe(url);
    await signs(page).nth(2).tap();
    await expect(page).toHaveURL(/\/today$/);

    await toSigns(page);
    await signs(page).nth(0).tap();
    await expect(signs(page).nth(0)).toHaveAttribute("data-active", "true");
    await page.touchscreen.tap(20, 880); // bare art, outside the panel and the signs
    await expect(page.locator('[data-testid="explore-path"][data-active]')).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("hanging signs on a touch screen, other cases", () => {
  test("a first tap on another sign only selects that one", async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
    await toSigns(page);
    const url = page.url();
    await signs(page).nth(0).tap();
    await signs(page).nth(1).tap();
    await expect(signs(page).nth(1)).toHaveAttribute("data-active", "true");
    await expect(page.locator('[data-testid="explore-path"][data-active]')).toHaveCount(1);
    expect(page.url()).toBe(url);
    await ctx.close();
  });

  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`in the panel's flow at ${vp.width}x${vp.height}: a tap selects and shows the caption without growing the panel; a second tap opens`, async ({ browser }) => {
      const ctx = await browser.newContext({ hasTouch: true, viewport: vp });
      const page = await ctx.newPage();
      await page.route("**/app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
      await page.goto("/?scene=sunset");
      await toHold(page, "s9");
      await expect(page.locator("ul[data-pinned]")).toHaveCount(0);
      const panel = page.locator('[data-hold="s9-hold"] [data-panel]');
      const before = (await panel.boundingBox())!;
      const url = page.url();
      await signs(page).nth(1).tap();
      await expect(signs(page).nth(1)).toHaveAttribute("data-active", "true");
      await expect(caption(page)).toBeVisible();
      await expect(caption(page)).toContainText(PATHS[1].line);
      expect(page.url()).toBe(url);
      expect((await panel.boundingBox())!.height).toBe(before.height);
      await signs(page).nth(1).tap();
      await expect(page).toHaveURL(/\/scripts$/);
      await ctx.close();
    });
  }
});

test.describe("hanging signs without scripts", () => {
  test("the five links are in the flow after the heading", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    const links = signs(page).locator("a");
    await expect(links).toHaveCount(5);
    for (const a of await links.all()) await expect(a).toBeVisible();
    const order = await page.evaluate(() => {
      const h = document.getElementById("explore-h")!;
      const want = [...document.querySelectorAll("p")].find((p) => p.textContent?.trim() === "Want one?")!;
      const after = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return [...document.querySelectorAll('[data-testid="explore-path"] a')].map((a) => after(h, a) && after(a, want));
    });
    expect(order).toEqual([true, true, true, true, true]);
    await ctx.close();
  });
});
