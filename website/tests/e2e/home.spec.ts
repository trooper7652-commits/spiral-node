import { expect, test, type Page } from "@playwright/test";
import { readFileSync, statSync } from "node:fs";
import { frameAt } from "../../lib/world/frame";
import { homeWorld, SECTIONS } from "../../lib/world/home";
import { SITE } from "../../lib/site";
import { canvasColours, lumaStd, pixelsIn, toHold, type Rgb } from "./world-helpers";

const shots = "design/screenshots";
const sunset = homeWorld("sunset", { opening: false }); // these tests start with the opening already seen (playwright.config.ts)
const raf2 = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
/** The viewport as the world data sees it: the width and the page's 100vh probe. */
const vpOf = (page: Page) => page.evaluate(() => ({ w: innerWidth, h: document.querySelector("[data-vh]")!.getBoundingClientRect().height }));

function watchErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("no console errors on / and /company, no pyodide on /", async ({ page }) => {
  const errors = watchErrors(page);
  const urls: string[] = [];
  page.on("response", (r) => urls.push(r.url()));
  // the repo may not exist yet (404 logs a console error); the community section's fallbacks have their own tests
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(urls.filter((u) => u.includes("pyodide"))).toEqual([]);
  expect(urls.filter((u) => u.includes("/_vercel/insights"))).toEqual([]);
  await page.goto("/company");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});



test("CLS under 0.05 on / at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
});


test("screenshots", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?scene=sunset");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${shots}/home-desktop.png` });
  // the home page is ~35 screens tall; past Chromium's 16384 px surface a full-page shot can run out of memory, so it stops there
  await page.screenshot({ path: `${shots}/home-desktop-full.jpg`, fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 16384 }, type: "jpeg", quality: 80 });
  await page.goto("/?scene=night");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${shots}/home-desktop-night.png` });
  expect(statSync(`${shots}/home-desktop-full.jpg`).size).toBeLessThan(1_500_000);
  expect(readFileSync(`${shots}/home-desktop.png`).equals(readFileSync(`${shots}/home-desktop-night.png`))).toBe(false);
  await page.goto("/company");
  await page.screenshot({ path: `${shots}/company-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});


const rect = (l: import("@playwright/test").Locator) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;


const CALLOUTS = ["Screen", "Spiral wheel", "Back", "Home", "USB-C", "Charge light", "Power button"];

test("design diagram shows the 7 callouts and the caption", async ({ page }) => {
  await page.goto("/spiral-node");
  const section = page.locator("figure").filter({ hasText: "Power button" });
  await section.scrollIntoViewIfNeeded();
  for (const t of CALLOUTS) await expect(section.getByText(t, { exact: true })).toBeVisible();
  await expect(section.getByText("Prototype design, may change.")).toBeVisible();
});

test.describe("no horizontal scroll at 360x800", () => {
  test.use({ viewport: { width: 360, height: 800 } });
  const width = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

  test("live, after the first frame", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-renderer][data-shot]")).toBeAttached();
    await page.waitForLoadState("networkidle");
    expect(await width(page)).toBeLessThanOrEqual(360);
  });

  test("hydrated, before any scene has drawn", async ({ page }) => {
    await page.route("**/world/**", () => {});
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hold="s3-hold"] button').first()).toBeAttached();
    // the page never grows wider than the screen at any frame of the load
    for (let i = 0; i < 30; i++) {
      expect(await width(page), `frame ${i}`).toBeLessThanOrEqual(360);
      await raf2(page);
    }
  });

  test.describe("with JavaScript off", () => {
    test.use({ javaScriptEnabled: false });
    test("in flow", async ({ page }) => {
      await page.goto("/");
      expect(await width(page)).toBeLessThanOrEqual(360);
    });
  });
});

test.describe("diagram, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("callouts and lines are drawn from the start", async ({ page }) => {
    await page.goto("/spiral-node");
    const section = page.locator("figure").filter({ hasText: "Power button" });
    await section.scrollIntoViewIfNeeded();
    for (const t of CALLOUTS) {
      const label = section.getByText(t, { exact: true });
      await expect(label).toBeVisible();
      expect(await label.evaluate((e) => { const s = getComputedStyle(e); return [s.opacity, s.transitionDuration]; })).toEqual(["1", "0s"]);
    }
    const offsets = await section.locator("svg path").evaluateAll((ps) => ps.map((p) => getComputedStyle(p).strokeDashoffset));
    expect(offsets.length).toBeGreaterThan(0);
    expect(offsets.every((o) => parseFloat(o) === 0)).toBe(true);
  });
});

test("phone and tablet screenshots", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, w, h] of [["home-phone", 390, 844], ["home-tablet", 768, 1024]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
});



test("community: GitHub rate-limited shows the fallback text, no number", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: '{"message":"API rate limit exceeded"}' }),
  );
  await page.goto("/");
  const c = page.getByTestId("community");
  await expect(c).toContainText("Be one of the first to star Spiral Node");
  await expect(c.getByTestId("star-count")).toHaveCount(0);
});

test("community: live star count from one request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.route("https://api.github.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: '{"stargazers_count":12}' }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const c = page.getByTestId("community");
  await expect(c.getByTestId("star-count")).toHaveText("12");
  await expect(c.getByRole("link", { name: "See everyone who has contributed" })).toHaveAttribute("href", `${SITE.repoUrl}/graphs/contributors`);
  await page.waitForLoadState("networkidle");
  expect(requests.filter((u) => u.startsWith("https://api.github.com/"))).toEqual([SITE.repoApi]);
});




test("body text uses VT323", async ({ page }) => {
  // next/font renames the family, so match the served font file against the bundled woff2
  const { readFileSync } = await import("node:fs");
  const vt323 = readFileSync("node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2").length;
  await page.goto("/");
  const size = await page.evaluate(async () => {
    const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    for (const sheet of Array.from(document.styleSheets))
      for (const rule of Array.from(sheet.cssRules))
        if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim() === family
            && ["normal", ""].includes(rule.style.getPropertyValue("font-style"))
            && rule.style.getPropertyValue("font-weight") === "400") {
          const url = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)![1];
          return (await (await fetch(url)).arrayBuffer()).byteLength;
        }
    return -1;
  });
  expect(size).toBe(vt323);
});

test("body text uses VT323 at 20 px or more", async ({ page }) => {
  await page.goto("/spiral-node");
  const p = page.locator("main p").first();
  expect(await p.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/VT323/);
  expect(parseFloat(await p.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);
});

test("scene 9: five paths with working links, then the launch list", async ({ page, request }) => {
  await page.goto("/");
  const s9 = page.locator('section[data-scene="s9"]');
  const paths = s9.getByTestId("explore-path").getByRole("link");
  await expect(paths).toHaveCount(5);
  const hrefs = await paths.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["/spiral-node", "/scripts", "/today", "/write", "/design"]);
  for (const h of hrefs) expect((await request.get(h!)).status()).toBe(200);
  await expect(page.getByRole("link", { name: "Join the launch list" })).toHaveCount(1);
  await expect(s9.getByRole("link", { name: "Join the launch list" })).toHaveAttribute("href", "/spiral-node#get-updates-h");
  await expect(s9.getByRole("link", { name: "★ Star on GitHub" })).toHaveCount(1);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("scene 8: the community notice board, reachable from the header", async ({ page }) => {
  await page.goto("/");
  const s8 = page.locator('section[data-scene="s8"]');
  await expect(s8.getByTestId("community")).toBeAttached();
  await expect(s8.getByRole("heading", { name: "Featured script: Connect" })).toBeAttached();
  await expect(s8.locator("#community")).toHaveCount(1);
});

const NAV_LINKS = ["Product", "Scripts", "Today", "Community", "Devlog", "Build log", "GitHub"];

for (const [width, height] of [[360, 800], [390, 844]]) {
  test(`phone header is one row at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    expect((await rect(page.locator("header"))).h).toBeLessThanOrEqual(72);
    const nav = page.locator("header").getByRole("navigation");
    for (const l of NAV_LINKS) await expect(nav.getByRole("link", { name: l })).toBeHidden();
    await expect(page.locator("header").getByRole("link", { name: "Try the demo" })).toBeVisible();
  });
}

test("at 800 px Try the demo sits on the launch list button's row", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto("/");
  const demo = await rect(page.locator("header").getByRole("link", { name: "Try the demo" }));
  const launch = await rect(page.locator("header").getByRole("button", { name: "Join the launch list" }));
  expect(Math.abs(demo.y + demo.h / 2 - (launch.y + launch.h / 2))).toBeLessThan(8);
});

test("desktop: header is one row at 1280 and 1400", async ({ page }) => {
  for (const width of [1280, 1400]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    expect((await rect(page.locator("header"))).h, `header at ${width}`).toBeLessThanOrEqual(64);
  }
});

test("desktop: Tab goes from GitHub to the launch list to Try the demo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("header").getByRole("link", { name: /GitHub/ }).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("header").getByRole("button", { name: "Join the launch list" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("header").getByRole("link", { name: "Try the demo" })).toBeFocused();
});

test("menu opens and lists all links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const btn = page.getByRole("button", { name: "Menu" });
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const nav = page.locator("header").getByRole("navigation");
  for (const l of NAV_LINKS) await expect(nav.getByRole("link", { name: l })).toBeVisible();
  const demo = await rect(page.locator("header").getByRole("link", { name: "Try the demo" }));
  const wordmark = await rect(page.locator("header").getByRole("link", { name: "Spiral Node", exact: true }));
  expect(Math.abs(demo.y - wordmark.y)).toBeLessThan(40);
  await nav.getByRole("link", { name: "Scripts" }).click();
  await expect(page).toHaveURL(/\/scripts$/);
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
});

test("escape closes the menu and focuses the button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const btn = page.getByRole("button", { name: "Menu" });
  await btn.click();
  await page.locator("header").getByRole("link", { name: "Product" }).focus();
  await page.keyboard.press("Escape");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await expect(btn).toBeFocused();
  await expect(page.locator("header").getByRole("link", { name: "Product" })).toBeHidden();
});

test("desktop shows the nav and no menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  const nav = page.locator("header").getByRole("navigation");
  for (const l of NAV_LINKS) await expect(nav.getByRole("link", { name: l })).toBeVisible();
});

test("the header's Try the demo opens /try", async ({ page }) => {
  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/try$/);
});

test("the story has nine scenes in order, each with its heading", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator('[data-testid="story-text"] section[data-scene]').evaluateAll((s) => s.map((e) => e.getAttribute("data-scene")));
  expect(ids).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]);
  for (const h of ["home-h", "purpose-h", "features-h", "design-h", "scripts-h", "roadmap-h", "faq-h", "community-h", "explore-h"])
    await expect(page.locator(`#${h}`)).toHaveCount(1);
  await expect(page.locator("#home-h")).toHaveText("Spiral Node");
  // the accent word is written out letter by letter, so its text sits twice in the DOM; the heading's name is the sentence
  await expect(page.locator("#purpose-h")).toHaveAccessibleName("Something to think about.");
});

test("scene 1 picks its sky on the client", async ({ browser, request }) => {
  // the server's HTML has no sky yet
  expect(await (await request.get("/")).text()).not.toContain("data-sky");
  const skyFor = async (r: number | null, query = "") => {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (r !== null) await page.addInitScript((v) => { Math.random = () => v; }, r);
    await page.goto("/" + query);
    const story = page.getByTestId("story");
    await expect(story).toHaveAttribute("data-sky", /^(sunset|night)$/);
    const sky = await story.getAttribute("data-sky");
    await context.close();
    return sky;
  };
  expect(await skyFor(0.1)).toBe("sunset");
  expect(await skyFor(0.9)).toBe("night");
  expect(await skyFor(0.1, "?scene=night")).toBe("night");
});

test("scene 2 has no buttons and no launch-list link", async ({ page }) => {
  await page.goto("/");
  const s2 = page.locator('section[data-scene="s2"]');
  await expect(s2).toContainText("for people who like to think");
  await expect(s2.getByRole("link")).toHaveCount(0);
  await expect(s2.getByRole("button")).toHaveCount(0);
});

// The eight emblems stay in the page, out of sight while the world runs (the tags on the picture show them); a keyboard reaches them.
test("scene 3: eight emblems in the page; Enter opens and closes one", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const items = page.getByTestId("feature");
  await expect(items).toHaveCount(8);
  const connect = page.locator('section[data-scene="s3"]').getByRole("button", { name: "Connect", exact: true }); // the tag on the picture is "Connect (on the picture)"
  await toHold(page, "s3");
  await expect(page.locator('[data-hold="s3-hold"] [data-panel]').getByRole("button")).toHaveCount(0);
  await expect(connect).toHaveAttribute("aria-expanded", "false");
  await connect.focus();
  await page.keyboard.press("Enter");
  await expect(connect).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#feature-connect")).toContainText("Two random topics. You find the link.");
  await expect(page.locator("#feature-connect")).toContainText("What links these?");
  await page.keyboard.press("Enter");
  await expect(connect).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#feature-connect")).toBeHidden();
});

const FAQ_QS = [
  "How long does the battery last?",
  "Is it private?",
  "Why no internet?",
  "Why not just a phone app?",
  "Isn't e-ink slow and black-and-white?",
  "Why not a Kindle?",
  "How much does it cost?",
  "Can I build my own?",
  "What if Helix Velocities disappears?",
  "Can I use it in class?",
  "Do I need to code?",
  "Where do the facts come from?",
];

/** Every box of the list, in viewport px. */
const boxesOf = (l: import("@playwright/test").Locator) => l.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));

for (const [w, h] of [[1280, 800], [390, 844]] as const) {
  test(`scene 7: twelve questions, the one the hold's progress picks is in the panel, whole on screen at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    const boxes = page.getByTestId("question");
    await expect(boxes.locator("h3")).toHaveText(FAQ_QS);
    const panel = page.locator('[data-hold="s7-hold"] [data-panel]');
    await expect(panel.getByTestId("question")).toHaveCount(12); // all twelve are in the panel's markup; one is shown
    // the progress through the hold picks the shown question: a few steps from the first to the last
    for (const step of [0, 4, 7, 11]) {
      await toHold(page, "s7", (step + 0.5) / 12);
      await expect(page.locator("ul[data-step]")).toHaveAttribute("data-step", String(step));
      await expect(boxes.nth(step)).toHaveAttribute("data-current", "true");
      await expect(page.locator('[data-testid="question"][data-current="true"]')).toHaveCount(1);
      await expect(boxes.nth(step).locator("h3")).toHaveCSS("color", "rgb(28, 26, 20)");
      await expect(boxes.nth(step).locator("p")).toBeVisible();
      const [q] = await boxesOf(boxes.nth(step));
      expect(onScreen({ top: q.y, bottom: q.y + q.h, left: q.x, right: q.x + q.w }, w, h), `step ${step} question on screen`).toBe(true);
      const [p] = await boxesOf(panel);
      expect(onScreen({ top: p.y, bottom: p.y + p.h, left: p.x, right: p.x + p.w }, w, h), `step ${step} panel on screen`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  });
}

for (const [w, h] of [[1280, 800], [390, 844]] as const) {
  test(`Back from a scene 9 path returns to the paths at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    const path = () => page.locator('section[data-scene="s9"]').getByTestId("explore-path").getByRole("link").nth(1);
    await toHold(page, "s9");
    await path().click();
    await expect(page).toHaveURL(/\/scripts$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/\?scene=sunset$/);
    await expect(page.locator('[data-hold="s9-hold"]')).toHaveCSS("opacity", "1");
    await expect(path()).toBeInViewport();
  });
}

test("the header's Community link on another page lands on the notice board", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/scripts");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Community" }).click();
  await expect(page).toHaveURL(/\/#community$/);
  // the anchor is the middle of the hold, so the text is fully shown there
  await expect(page.locator('[data-hold="s8-hold"]')).toHaveCSS("opacity", "1");
  await expect(page.locator("#community-h")).toBeInViewport();
});

// The cause of the old failure: a tall hold rolled up the screen by an offset worked out from the section's height, and that height came from a ResizeObserver
// that had not yet seen the current question's text when the frame landed (nothing re-ran the offset when it did), so the layout depended on timing.
// A panel is placed by CSS alone and never rolls, so there is no offset to go stale.
test("scene 7: the same layout on every visit", async ({ page }) => {
  const layout = async () => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s7");
    // the font may land after the first frame; read after that
    await page.evaluate(() => document.fonts.ready);
    await raf2(page);
    return [await boxesOf(page.getByTestId("question")), await boxesOf(page.locator('[data-hold="s7-hold"] [data-panel]'))];
  };
  expect(await layout()).toEqual(await layout());
});

test("a reload at the middle of hold s5 shows its panel whole, at the same box as arriving by scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await toHold(page, "s5");
  await page.evaluate(() => document.fonts.ready);
  const panel = page.locator('[data-hold="s5-hold"] [data-panel]');
  const arrived = (await boxesOf(panel))[0];
  await page.reload();
  await expect(page.getByTestId("story")).toHaveAttribute("data-sky", /^(sunset|night)$/);
  // the browser restores the scroll position after the load, with or without a scroll event
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await expect(page.locator('[data-hold="s5-hold"]')).toHaveCSS("opacity", "1");
  await page.evaluate(() => document.fonts.ready);
  await raf2(page);
  const reloaded = (await boxesOf(panel))[0];
  expect(reloaded).toEqual(arrived);
  expect(onScreen({ top: reloaded.y, bottom: reloaded.y + reloaded.h, left: reloaded.x, right: reloaded.x + reloaded.w }, 1280, 800)).toBe(true);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("all nine scenes read with no motion", async ({ page }) => {
    await page.goto("/?scene=sunset");
    for (const id of SECTIONS) {
      await toHold(page, id);
      const hold = page.locator(`[data-hold="${id}-hold"]`);
      await expect(hold.locator("h1, h2").first()).toBeVisible();
      await expect(hold.locator("h1, h2").first()).toBeInViewport();
      await expect(hold.locator("[data-panel]")).toBeInViewport({ ratio: 1 });
    }
  });
});

// The sketch and its labels stay in the page, out of sight while the world runs (the tags on the picture show the parts).
test("scene 4: the sketch's five part labels are in the page", async ({ page }) => {
  await page.goto("/?scene=sunset");
  await expect(page.locator('section[data-scene="s4"]').getByTestId("part-label")).toHaveText(["USB-C top", "Screen", "Back", "Home", "Spiral wheel"]);
});

test("scene 5: three example scripts and See more", async ({ page }) => {
  await page.goto("/");
  const s5 = page.locator('section[data-scene="s5"]');
  await expect(s5.getByTestId("script-card")).toHaveCount(3);
  await expect(s5.getByRole("link", { name: "See more scripts" })).toHaveAttribute("href", "/scripts");
});

test("scene 6: the latest post in the panel, the roadmap in the page", async ({ page }) => {
  await page.goto("/?scene=sunset");
  const s6 = page.locator('section[data-scene="s6"]');
  await expect(s6.getByTestId("roadmap").locator("ol li").first()).toBeAttached();
  await expect(s6.getByTestId("latest-post").getByRole("link").first()).toHaveAttribute("href", /^\/devlog\/.+/);
  const panel = s6.locator("[data-panel]");
  await expect(panel.getByTestId("latest-post")).toHaveCount(1);
  await expect(panel.getByTestId("roadmap")).toHaveCount(0);
  await toHold(page, "s6");
  await expect(s6.getByTestId("latest-post")).toBeInViewport({ ratio: 1 });
});

const onScreen = (b: { top: number; bottom: number; left: number; right: number }, w: number, h: number) => b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w;

// 844x390 and 740x360 are short landscape screens: the trail is a 56 px bar along the bottom and the panel sits at the top, whole, with its bar line and no inner scroll.
for (const [w, h] of [[360, 640], [844, 390], [740, 360]] as const) {
  test(`no hold scrolls inside itself, and every panel is whole on screen at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    const strip = h < w ? 56 : 72; // the bar on a short landscape screen, the strip under a sheet
    for (const id of SECTIONS) {
      await toHold(page, id);
      const hold = page.locator(`[data-hold="${id}-hold"]`);
      const [scroll, client] = await hold.evaluate((e) => [e.scrollHeight, e.clientHeight]);
      expect(scroll, id).toBeLessThanOrEqual(client + 1);
      const panel = page.locator(`[data-hold="${id}-hold"] [data-panel]`);
      const [b] = await boxesOf(panel);
      expect(onScreen({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w }, w, h - strip), `${id} panel whole above the strip`).toBe(true);
      // the bar line of the panel is the first thing in it and it is shown
      await expect(panel.getByText(/^SCENE \d$/)).toBeInViewport({ ratio: 1 });
      // body text stays at least 20 px
      expect(await panel.locator("p").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), `${id} body text`).toBeGreaterThanOrEqual(20);
    }
  });
}

for (const [w, h] of [[360, 640], [1280, 800]] as const) {
  test(`a hold's panel never rolls: whole on screen from the fade-in to the fade-out at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    const panelBox = async (id: string) => {
      const [b] = await boxesOf(page.locator(`[data-hold="${id}-hold"] [data-panel]`));
      return { top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w };
    };
    for (const id of SECTIONS) {
      await toHold(page, id, 0.26);
      await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1");
      const first = await panelBox(id);
      expect(onScreen(first, w, h), `${id} panel after the fade-in`).toBe(true);
      // on a phone the panel's top clears the fixed header (shown on demand, but its band is laid out)
      if (w === 360) {
        const header = (await page.locator("header").first().boundingBox())!;
        expect(first.top, `${id} panel clears the header`).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
      }
      await toHold(page, id, 0.74);
      await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1");
      const footerTop = () => page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().top);
      if ((await footerTop()) < h) {
        // the footer has come up over the last shot and pushed its panel ahead of it: the panel never sits under it
        expect((await panelBox(id)).bottom, `${id} panel above the footer`).toBeLessThanOrEqual(await footerTop());
        await page.evaluate(() => window.scrollTo({ top: document.querySelector("footer")!.getBoundingClientRect().top + scrollY - innerHeight, behavior: "instant" }));
        await raf2(page);
      }
      const last = await panelBox(id);
      expect(onScreen(last, w, h), `${id} panel before the fade-out`).toBe(true);
      // it stays where it is docked (a panel is placed by CSS alone; text that does not fit is in the hidden flow)
      expect([last.left, last.right], id).toEqual([first.left, first.right]);
    }
  });
}

test("tabbing to the last link of scene 5's panel leaves it on screen at 360x640", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  const last = page.locator('[data-hold="s5-hold"] [data-panel] a').last();
  for (let i = 0; i < 60 && !(await last.evaluate((a) => a === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-hold="s5-hold"]')).toHaveCSS("opacity", "1");
});

test("the world is never one flat colour", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i < 60; i++) {
    // the canvas reports the frame it has drawn; the scroll position it was drawn at is read back, not assumed
    const y = await page.evaluate((y) => { window.scrollTo({ top: y, behavior: "instant" }); return window.scrollY; }, Math.round((i / 59) * max));
    const want = frameAt(sunset, y, await vpOf(page));
    const state = page.locator("[data-renderer]");
    await expect(state).toHaveAttribute("data-shot", want.a.shot);
    await expect(state).toHaveAttribute("data-mix", String(Math.round(want.mix * 1000) / 1000));
    await raf2(page);
    // inside a join the art may be enlarged into a few hard pixels; it is still never one colour, except at the middle of a light join, where the light fills the view
    // (the ink join's picture is ink on paper: two colours until the colour spreads)
    const least = want.kind === "light" && Math.abs(want.mix - 0.5) < 0.1 ? 1 : want.kind === "ink" && want.mix >= 0.5 ? 2 : want.mix > 0 ? 3 : 8;
    await expect.poll(async () => (await canvasColours(page)).length, { message: `colours at scroll ${y}` }).toBeGreaterThanOrEqual(least);
  }
});

test("every join carries its own kind, in the spec's order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  const vp = await vpOf(page);
  let start = 0;
  for (let i = 0; i < sunset.joins.length; i++) {
    const join = sunset.joins[i];
    expect(join.kind).not.toBe("push");
    start += (sunset.shots[i].lengthVh * vp.h) / 100;
    const middle = start + (join.lengthVh * vp.h) / 200;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), middle);
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-kind", join.kind);
    await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", sunset.shots[i].id);
    start += (join.lengthVh * vp.h) / 100;
  }
});

const lum = ([r, g, b]: Rgb) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// The panel is opaque paper, so this holds by construction; it stays as a guard. On both skies (they differ only in the art), on a laptop and on two phones.
for (const sky of ["sunset", "night"] as const) {
  for (const [W, H] of [[1280, 800], [390, 844], [360, 640]] as const) {
    test(`home holds are legible on the ${sky} sky at ${W}x${H}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: "reduce" }); // no blink or pop while the pixels are read
      // the sign-up popup's timer fires within this long test on a slow run, and its backdrop would be read as the panel's ground
      await page.addInitScript(() => localStorage.setItem("sn-welcome", "skipped"));
      await page.setViewportSize({ width: W, height: H });
      await page.goto(`/?scene=${sky}`);
      for (const id of SECTIONS) {
       for (const t of [0.251, 0.74]) {
        await toHold(page, id, t);
        await expect(page.locator(`[data-hold="${id}-hold"]`)).toHaveCSS("opacity", "1");
        // the last hold is pushed up by the footer before its end; it is read where it rests, just before the footer comes on screen
        if (t > 0.5 && (await page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().top)) < H) {
          await page.evaluate(() => window.scrollTo({ top: document.querySelector("footer")!.getBoundingClientRect().top + scrollY - innerHeight, behavior: "instant" }));
          await raf2(page);
        }
        const boxes = await page.evaluate((id) => {
          const panel = document.querySelector(`[data-hold="${id}-hold"] [data-panel]`)!;
          const r = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
          const ink = (e: Element) => (getComputedStyle(e).color.match(/\d+/g)!.slice(0, 3).map(Number)) as [number, number, number];
          const heading = panel.querySelector("h1, h2")!;
          // the first body paragraph that is actually shown (the questions not picked keep theirs out of sight)
          // on short phones a panel may show only its heading and links (its lines move to the hidden flow); then the heading stands in
          const body = [...panel.querySelectorAll("p")].find((e) => e.getBoundingClientRect().width > 4) ?? heading;
          const label = panel.querySelector("span")!; // the first one is the bar's label
          // every element that holds text of its own (not a button, which has a ground of its own)
          const texts = [...panel.querySelectorAll("*")]
            .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && e.getBoundingClientRect().width > 4 && !e.closest(".btn, button"))
            .map((e) => ({ box: r(e), ink: ink(e), min: /^H[1-3]$/.test(e.tagName) ? 3 : 4.5 }));
          return { h: r(heading), p: r(body), label: r(label), ink: { h: ink(heading), p: ink(body), label: ink(label) }, texts };
        }, id);
        const shown = (b: { x: number; y: number; w: number; h: number }) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
        for (const name of ["h", "p", "label"] as const) expect(shown(boxes[name]), `${id} ${name} on screen at ${t}`).toBe(true);
        // the label and the heading do not share a box
        expect(hit(boxes.label, boxes.h), `${id} label and heading`).toBe(false);
        // the text goes clear, so what is read is the ground under it
        const hide = await page.addStyleTag({ content: "[data-hold] [data-panel] * { color: transparent !important; text-decoration-color: transparent !important; }" });
        const read = boxes.texts.filter((x) => shown(x.box));
        const [h, p, label, ...rest] = await pixelsIn(page, [boxes.h, boxes.p, boxes.label, ...read.map((x) => x.box)]);
        await hide.evaluate((e) => (e as Element).remove());
        const p10 = (px: Rgb[], ink: Rgb) => px.map((c) => contrast(c, ink)).sort((a, b) => a - b)[Math.floor(px.length * 0.1)];
        const parts = [
          ["heading", h, boxes.ink.h, 3], ["body", p, boxes.ink.p, 4.5], ["label", label, boxes.ink.label, 4.5],
          ...read.map((x, i) => [`text ${i}`, rest[i], x.ink, x.min] as const),
        ] as const;
        for (const [name, px, ink, min] of parts) expect(p10(px, ink), `${id} ${name} at ${t}`).toBeGreaterThanOrEqual(min);
       }
      }
    });
  }
}

test("wheel, PageDown and Home scroll natively", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await page.evaluate(() => {
    window.addEventListener("wheel", (e) => setTimeout(() => { (window as any).__prevented = ((window as any).__prevented ?? false) || e.defaultPrevented; }), { passive: true });
  });
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__prevented)).toBe(false);

  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);

  // wait for the smooth scroll to end
  await expect
    .poll(async () => {
      const a = await page.evaluate(() => scrollY);
      await raf2(page);
      await raf2(page);
      return a === (await page.evaluate(() => scrollY));
    })
    .toBe(true);

  await page.keyboard.press("Home");
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 10_000 }).toBe(0);
});

test("End shows the last scene within a second, never a blank canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  await page.keyboard.press("End");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s9", { timeout: 1000 });
  await raf2(page);
  expect(await lumaStd(page)).toBeGreaterThanOrEqual(6);
});

test("a reload halfway down paints the right shot within a second", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?scene=sunset");
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", "s1");
  await page.evaluate(() => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) / 2, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.reload();
  await expect(page.getByTestId("story")).toHaveAttribute("data-sky", /^(sunset|night)$/);
  // the browser restores the scroll position after the load, which can land after hydration
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(1000);
  const want = frameAt(sunset, y, await vpOf(page));
  await expect(page.locator("[data-renderer]")).toHaveAttribute("data-shot", want.a.shot, { timeout: 1000 });
  await raf2(page);
  expect(await lumaStd(page)).toBeGreaterThanOrEqual(6);
});



for (const [w, h] of [[1440, 900], [390, 844]] as const)
  test(`at the end of the page the footer is its own ink band, on top of the art and the signs, at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?scene=sunset");
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const footer = page.locator("footer");
    await expect(footer).toHaveCSS("background-color", "rgb(28, 26, 20)");
    let checked = 0;
    for (const link of await footer.getByRole("link").all()) {
      if (!(await link.isVisible()) || !(await link.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }))) continue;
      const hit = await link.evaluate((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && (e === t || e.contains(t)); });
      expect(hit, `${await link.textContent()} is on top`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

// Scene 5's three script screens: on the art beside the panel on a laptop, stacked in the bottom sheet on a phone.
const screenFacts = (page: Page) => page.getByTestId("script-screen").evaluateAll((as) => as.map((a) => {
  const rgb = (c: string) => c.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number];
  const r = a.getBoundingClientRect();
  const [title, sample] = [...a.querySelectorAll("span")];
  return {
    href: a.getAttribute("href"), box: { x: r.x, y: r.y, w: r.width, h: r.height },
    sizes: [parseFloat(getComputedStyle(title).fontSize), parseFloat(getComputedStyle(sample).fontSize)],
    ink: rgb(getComputedStyle(sample).color), ground: rgb(getComputedStyle(a).backgroundColor),
  };
}));
const SCREEN_HREFS = ["/scripts/fun_fact_question", "/scripts/daily_puzzle", "/scripts/big_questions"];

test("scene 5: three script screens on the art at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?scene=sunset");
  await toHold(page, "s5");
  await page.evaluate(() => document.fonts.ready);
  await raf2(page);
  const links = page.getByTestId("script-screen");
  await expect(links).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(links.nth(i)).toBeVisible();
  const facts = await screenFacts(page);
  expect(facts.map((f) => f.href)).toEqual(SCREEN_HREFS);
  for (const f of facts) {
    for (const px of f.sizes) expect(px).toBeGreaterThanOrEqual(20);
    expect(contrast(f.ink, f.ground)).toBeGreaterThanOrEqual(4.5);
    expect(onScreen({ top: f.box.y, bottom: f.box.y + f.box.h, left: f.box.x, right: f.box.x + f.box.w }, 1440, 900)).toBe(true);
  }
  const others = [...(await boxesOf(page.locator('[data-hold="s5-hold"] [data-panel]'))), ...(await boxesOf(page.locator("nav[data-trail]")))];
  facts.forEach((f, i) => {
    facts.slice(i + 1).forEach((g) => expect(hit(f.box, g.box)).toBe(false));
    others.forEach((o) => expect(hit(f.box, o)).toBe(false));
  });
});

test("scene 5: the three script screens stack in the bottom sheet at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scene=sunset");
  await toHold(page, "s5");
  const panel = page.locator('[data-hold="s5-hold"] [data-panel]');
  const links = panel.getByTestId("script-screen");
  await expect(links).toHaveCount(3);
  const facts = await screenFacts(page);
  expect(facts.map((f) => f.href)).toEqual(SCREEN_HREFS);
  facts.forEach((f, i) => {
    f.sizes.forEach((px) => expect(px).toBeGreaterThanOrEqual(20));
    if (i) expect(f.box.y).toBeGreaterThanOrEqual(facts[i - 1].box.y + facts[i - 1].box.h);
  });
  // the sheet scrolls: each one can be brought on screen
  for (let i = 0; i < 3; i++) {
    await links.nth(i).scrollIntoViewIfNeeded();
    await expect(links.nth(i)).toBeInViewport({ ratio: 1 });
  }
});
