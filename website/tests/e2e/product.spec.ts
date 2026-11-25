import { expect, test } from "@playwright/test";
import { PRODUCT_IMAGES } from "../../lib/product";
import { SITE } from "../../lib/site";

test("/spiral-node has its h1 and a placeholder for each photo not yet added", async ({ page }) => {
  await page.goto("/spiral-node");
  await expect(page.getByRole("heading", { level: 1, name: "Spiral Node" })).toBeVisible();
  const slots = page.getByTestId("placeholder");
  await expect(slots).toHaveCount(PRODUCT_IMAGES.filter((i) => i.src === null).length);
  for (const slot of await slots.all()) {
    await expect(slot).toHaveAttribute("role", "img");
    expect(await slot.getAttribute("aria-label")).toMatch(/coming soon\)$/);
    await expect(slot).toHaveText(/coming soon/i);
  }
  for (const { src } of PRODUCT_IMAGES.filter((i) => i.src !== null)) {
    const img = page.locator(`img[src="${src}"]`);
    await expect(img).toHaveCount(1);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  }
});

test("day cards run the three scripts", async ({ page, request }) => {
  await page.goto("/spiral-node");
  for (const id of ["fun_fact_question", "chess_puzzles", "poems"]) {
    await expect(page.locator(`a[href="/try?script=${id}"]`)).toHaveCount(1);
    expect((await request.get(`/og/script-${id}.png`)).status()).toBe(200);
  }
});

test("specs list shows every row", async ({ page }) => {
  await page.goto("/spiral-node");
  await expect(page.locator('section[aria-labelledby="specs-h"] dt')).toHaveCount(7);
});

test("sign-up section works with or without the email service", async ({ page }) => {
  await page.goto("/spiral-node");
  const s = page.locator('section[aria-labelledby="get-updates-h"]');
  await expect(s.getByRole("heading", { name: "Join the launch list" })).toBeVisible();
  await expect(s.getByRole("link", { name: /Star on GitHub/ })).toHaveAttribute("href", SITE.repoUrl);
  if (SITE.newsletterFormUrl) {
    await expect(s.locator("form")).toHaveCount(1);
    await expect(s.locator('input[type="email"]')).toHaveCount(1);
  } else {
    await expect(s.locator("form")).toHaveCount(0);
    await expect(s).toContainText("Email updates are coming soon");
  }
});

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`first screen shows the launch list without scrolling at ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/spiral-node");
    await expect(page.locator("#hero-cta").getByRole("link", { name: "Join the launch list" })).toBeInViewport();
  });
}

test("demo clip sits on the first screen with its poster", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/spiral-node");
  const v = page.locator('video[poster="/press/demo-poster.png"]');
  await expect(v).toHaveCount(1);
  await page.waitForLoadState("load");
  expect(await v.evaluate((e: HTMLVideoElement) => e.paused)).toBe(true);
  await ctx.close();
});

test("four benefits, three steps, six questions", async ({ page }) => {
  await page.goto("/spiral-node");
  await expect(page.locator('section[aria-labelledby="why-h"] li')).toHaveCount(4);
  await expect(page.locator('section[aria-labelledby="how-h"] ol > li')).toHaveCount(3);
  const q = page.locator('section[aria-labelledby="questions-h"] details');
  await expect(q).toHaveCount(6);
  await expect(q.first().locator("summary")).toHaveText("How much does it cost?");
});

test("phone sticky bar appears between the hero and the sign-up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spiral-node");
  const bar = page.getByTestId("sticky-launch-bar").getByRole("link", { name: "Join the launch list" });
  await expect(bar).toBeHidden();
  await page.locator("#day-h").scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  await page.locator("#get-updates-h").scrollIntoViewIfNeeded();
  await expect(bar).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("#day-h").scrollIntoViewIfNeeded();
  await expect(bar).toBeHidden();
});

test("bar stays hidden while the sign-up section or footer is on screen, and returns above", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spiral-node");
  const bar = page.getByTestId("sticky-launch-bar").getByRole("link", { name: "Join the launch list" });
  const sec = page.locator('section[aria-labelledby="get-updates-h"]');
  await page.locator("#day-h").scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  const star = sec.getByRole("link", { name: /Star on GitHub/ });
  await page.evaluate(() => {
    const h = document.getElementById("get-updates-h")!;
    window.scrollBy(0, h.getBoundingClientRect().bottom + 4);
  });
  await expect(star).toBeInViewport();
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(bar).toBeHidden();
  await page.locator("#day-h").scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
});

test("the bar never covers the end of the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spiral-node");
  await page.locator("#day-h").scrollIntoViewIfNeeded();
  const bar = page.getByTestId("sticky-launch-bar");
  await expect(bar).toBeVisible();
  const h = (await bar.boundingBox())!.height;
  const pad = await page.locator("main").evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(h);
});

test("header Product link opens the product page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Product" })).toHaveAttribute("href", "/spiral-node");
});

test("no sideways scroll at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/spiral-node");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the first heading in main is the h1", async ({ page }) => {
  await page.goto("/spiral-node");
  const first = page.locator("main :is(h1,h2,h3)").first();
  expect(await first.evaluate((e) => e.tagName)).toBe("H1");
  await expect(first).toHaveText("Spiral Node");
});
