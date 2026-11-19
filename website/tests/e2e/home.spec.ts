import { expect, test } from "@playwright/test";

const shots = "design/screenshots";

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

test("Try the demo in the header; the hero's Open the full simulator opens /try", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Try the demo" })).toBeVisible();
  const hero = page.getByRole("link", { name: "Open the full simulator" });
  await expect(hero).toBeVisible();
  await hero.click();
  await expect(page).toHaveURL(/\/try$/);
});

test("Try it right here boots Spiral OS inside the hero device", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try it right here" }).click();
  const hero = page.locator("main section").first();
  const canvas = hero.getByTestId("screen");
  await expect(canvas).toHaveAttribute("data-screen", "home", { timeout: 60_000 });
  const c = await rect(canvas);
  const d = await rect(page.locator("main img[src*='hero-device']"));
  expect(c.x).toBeGreaterThanOrEqual(d.x);
  expect(c.y).toBeGreaterThanOrEqual(d.y);
  expect(c.x + c.w).toBeLessThanOrEqual(d.x + d.w + 0.5);
  expect(c.y + c.h).toBeLessThanOrEqual(d.y + d.h);
  expect(await page.evaluate(() => document.documentElement.dataset.demo)).toBe("running");
  await expect(page.getByTestId("hero-demo")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-screen", "menu");
  await expect(page.getByRole("button", { name: "Play scenery" })).toBeVisible();
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

test("pause button stops the slide", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause scenery" }).click();
  await expect(page.getByRole("button", { name: "Play scenery" })).toBeVisible();
});

test("screenshots", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${shots}/home-desktop.png` });
  await page.screenshot({ path: `${shots}/home-desktop-full.png`, fullPage: true });
  await page.getByRole("button", { name: "Show night" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/home-desktop-night.png` });
  await page.goto("/company");
  await page.screenshot({ path: `${shots}/company-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reduced motion: sunset, no auto slide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const track = page.getByTestId("scene-track");
  const before = await track.evaluate((e) => getComputedStyle(e).transform);
  await page.waitForTimeout(9000);
  expect(await track.evaluate((e) => getComputedStyle(e).transform)).toBe(before);
  await expect(page.getByRole("button", { name: "Show night" })).toBeVisible();
});

const rect = (l: import("@playwright/test").Locator) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
  for (const scene of ["sunset", "night"] as const) {
    test(`hero at ${w}x${h} ${scene}: snail visible, clear of group; pause in viewport`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      if (scene === "night") {
        await page.getByRole("button", { name: "Show night" }).click();
        await page.waitForTimeout(1500);
      }
      const snail = await rect(page.getByTestId("snail").nth(scene === "sunset" ? 0 : 1));
      const stage = await rect(page.locator("main section").first());
      expect(snail.x).toBeGreaterThanOrEqual(0);
      expect(snail.x + snail.w).toBeLessThanOrEqual(w);
      expect(snail.y).toBeGreaterThanOrEqual(stage.y);
      expect(snail.y + snail.h).toBeLessThanOrEqual(Math.min(h, stage.y + stage.h));
      for (const l of [page.locator("main h1").locator(".."),page.locator("main img[src*='hero-device']"), page.getByRole("button", { name: "Try it right here" })])
        expect(hit(snail, await rect(l))).toBe(false);
      const pause = await rect(page.locator("main button").first());
      expect(pause.x).toBeGreaterThanOrEqual(0);
      expect(pause.y).toBeGreaterThanOrEqual(0);
      expect(pause.x + pause.w).toBeLessThanOrEqual(w);
      expect(pause.y + pause.h).toBeLessThanOrEqual(h);
      console.log(`RECTS ${w}x${h} ${scene}`, JSON.stringify({ snail, pause }));
    });
  }
}

const CALLOUTS = ["Screen", "Spiral wheel", "Back", "Home", "USB-C", "Charge light", "Power button"];

test("design diagram shows the 7 callouts and the caption", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby='design-h']");
  await section.scrollIntoViewIfNeeded();
  for (const t of CALLOUTS) await expect(section.getByText(t, { exact: true })).toBeVisible();
  await expect(section.getByText("Prototype design, may change.")).toBeVisible();
});

test("no horizontal scroll at 360x800", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test.describe("diagram, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("callouts and lines are drawn from the start", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby='design-h']");
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
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
});

test("feature grid: 8 cards; opening one shows its detail", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByTestId("feature");
  await expect(cards).toHaveCount(8);
  const connect = cards.filter({ hasText: "Two random topics. You find the link." });
  await connect.locator("summary").click();
  await expect(connect.getByText("What links these?")).toBeVisible();
});

test("FAQ has the twelve questions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#faq-h").locator("..").locator("summary")).toHaveText([
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
  ]);
});

test("community: GitHub rate-limited shows the fallback texts", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: '{"message":"API rate limit exceeded"}' }),
  );
  await page.goto("/");
  const c = page.getByTestId("community");
  await expect(c).toContainText("Be one of the first to star Spiral Node");
  await expect(c).toContainText("Be the first contributor: write a script");
});

test("community: live star count and avatars, bots left out", async ({ page }) => {
  await page.route("https://avatars.githubusercontent.com/**", (r) => r.abort());
  await page.route("https://api.github.com/**", (r) => {
    const people = [
      { login: "ada", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", html_url: "https://github.com/ada" },
      { login: "dependabot[bot]", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4", html_url: "https://github.com/apps/dependabot" },
    ];
    const body = r.request().url().includes("/contributors") ? people : { stargazers_count: 12 };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const c = page.getByTestId("community");
  await expect(c.getByTestId("star-count")).toHaveText("12");
  await expect(c.getByRole("img", { name: "ada" })).toHaveCount(1);
  await expect(c.getByRole("img", { name: "dependabot[bot]" })).toHaveCount(0);
});

test("purpose section follows the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#purpose-h")).toHaveText("Something to think about.");
  await expect(page.locator("#purpose-h").locator("..")).toContainText("for people who like to think");
});

test("scene animals visible", async ({ page }) => {
  await page.goto("/");
  for (const id of ["butterfly-1", "deer-doe", "dog", "frog-1"]) await expect(page.getByTestId(id).first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Show night" }).click();
  for (const id of ["owl", "firefly-1", "deer-night"]) await expect(page.getByTestId(id).first()).toBeVisible();
});

const heroAnimations = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const hero = document.querySelector("main section")!;
    return hero.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation).map((a) => `${(a as CSSAnimation).animationName}:${a.playState}`);
  });

test("pause stops every scene animation", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect((await heroAnimations(page)).filter((a) => a.endsWith(":running")).length).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Pause scenery" }).click();
  expect((await heroAnimations(page)).filter((a) => a.endsWith(":running"))).toEqual([]);
});

test("reduced motion: no scene animation runs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect((await heroAnimations(page)).filter((a) => a.endsWith(":running"))).toEqual([]);
  const cast = await page.evaluate(() => [...document.querySelectorAll("main section [data-testid]:not([data-testid=\"scene-track\"])")].flatMap((e) => e.getAnimations({ subtree: true })).length);
  expect(cast).toBe(0);
});

test("fireflies blink at most once a second", async ({ page }) => {
  await page.goto("/");
  const durations = await page.evaluate(() =>
    Array.from({ length: 8 }, (_, i) => [...document.querySelectorAll(`[data-testid="firefly-${i + 1}"]`)].flatMap((e) => e.getAnimations({ subtree: true }).map((a) => Number(a.effect!.getTiming().duration)))),
  );
  for (const d of durations) {
    expect(d.length).toBeGreaterThan(0);
    expect(Math.min(...d)).toBeGreaterThanOrEqual(1000);
  }
});

test("body text uses IBM Plex Mono", async ({ page }) => {
  // next/font renames the family, so match the served font file against the package's Plex woff2
  const { readFileSync } = await import("node:fs");
  const plex = readFileSync("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2").length;
  await page.goto("/");
  const size = await page.evaluate(async () => {
    const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    for (const sheet of Array.from(document.styleSheets))
      for (const rule of Array.from(sheet.cssRules))
        if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim() === family
            && ["400", "normal"].includes(rule.style.getPropertyValue("font-weight"))) {
          const url = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)![1];
          return (await (await fetch(url)).arrayBuffer()).byteLength;
        }
    return -1;
  });
  expect(size).toBe(plex);
});

test("explore row has 4 cards with working links", async ({ page, request }) => {
  await page.goto("/");
  const cards = page.getByTestId("explore-card");
  await expect(cards).toHaveCount(4);
  const hrefs = await cards.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect([...hrefs].sort()).toEqual(["/design", "/scripts", "/today", "/write"]);
  await expect(cards.locator("img[alt='']")).toHaveCount(4);
  // /today and /design are not built yet; only the live pages must resolve
  for (const h of ["/scripts", "/write"]) expect((await request.get(h)).status()).toBe(200);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("phone 360x640: hero device is at least 70% of the width and Try it right here is above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const device = await page.locator("main img[src*='hero-device']").boundingBox();
  expect(device!.width).toBeGreaterThanOrEqual(252);
  const btn = await page.getByRole("button", { name: "Try it right here" }).boundingBox();
  expect(btn!.y + btn!.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
