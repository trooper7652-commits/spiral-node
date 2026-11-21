import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("/scripts lists every script, each linking to the simulator", async ({ page }) => {
  await page.goto("/scripts");
  await expect(page.getByTestId("script-card")).toHaveCount(7);
  for (const id of ["chess_puzzles", "connect", "fun_fact_question", "on_this_day", "poems", "quick_story", "space_facts"]) await expect(page.locator(`a[href="/try?script=${id}"]`)).toHaveCount(1);
});

test("/scripts/chess_puzzles shows name, description, author, Run in simulator, Copy link, and og:image = /og/script-chess_puzzles.png", async ({ page }) => {
  await page.goto("/scripts/chess_puzzles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chess Puzzles");
  await expect(page.locator("main")).toContainText("by ");
  await expect(page.getByRole("link", { name: "Run in simulator" })).toHaveAttribute("href", "/try?script=chess_puzzles");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect(page.locator("main p").first()).not.toBeEmpty();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/script-chess_puzzles\.png$/);
});

test("unknown id → 404 page", async ({ page }) => {
  // the static export has no page for an unknown id and Next's 404 page ships as out/404.html;
  // the preview server answers unknown paths with a fallback page instead of a 404 status, so check the files and the 404 page itself
  expect(existsSync("out/scripts/does_not_exist.html")).toBe(false);
  expect(existsSync("out/scripts/chess_puzzles.html")).toBe(true);
  await page.goto("/404.html");
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("/devlog lists the first entry, and it opens", async ({ page }) => {
  await page.goto("/devlog");
  await page.getByRole("link", { name: "Spiral Node is open source" }).click();
  await expect(page).toHaveURL(/\/devlog\/2026-11-16-open-source$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spiral Node is open source");
});

test("/press has the logo download, and the file is there", async ({ page, request }) => {
  await page.goto("/press");
  await expect(page.getByRole("link", { name: /Spiral logo/ })).toHaveAttribute("href", "/press/spiral-node-logo.png");
  expect((await request.get("/press/spiral-node-logo.png")).status()).toBe(200);
});

test("contest page shows rules, the current theme, and a link to /write", async ({ page }) => {
  await page.goto("/contest");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Script of the Month");
  await expect(page.locator("main")).toContainText("Questions worth sitting with");
  await expect(page.locator("main")).toContainText("No purchase needed");
  await expect(page.locator('main a[href="/write"]')).toHaveCount(1);
});

test("founder page renders", async ({ page }) => {
  await page.goto("/founder");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Why I started Spiral Node");
  await expect(page.locator("main")).toContainText("connect ideas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test('build log shows "First photos coming soon" with no entries', async ({ page }) => {
  await page.goto("/build-log");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build log");
  await expect(page.locator("main")).toContainText("First photos coming soon.");
});

test("changelog lists v0.1.0", async ({ page }) => {
  await page.goto("/changelog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  await expect(page.getByRole("heading", { name: "v0.1.0 (2026-11-21)" })).toBeVisible();
  await expect(page.locator("main")).toContainText("open hardware notes");
});

test("home links to the script gallery and the latest devlog entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('main a[href="/scripts"]')).toHaveCount(2); // "See all scripts" and the Explore row card;
  await expect(page.locator('main a[href="/devlog/2026-11-16-open-source"]')).toHaveCount(1);
});

for (const path of ["/", "/try", "/scripts", "/devlog", "/devlog/2026-11-16-open-source", "/press", "/company"]) {
  test(`link preview image on ${path}`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/spiral-node-helix-velocities.vercel.app\/og\/[a-z]+\.png"/);
  });
}

test("press page has a demo video with a poster and controls", async ({ page }) => {
  await page.goto("/press");
  const v = page.locator("video");
  await expect(v).toHaveAttribute("poster", "/press/demo-poster.png");
  await expect(v).toHaveAttribute("controls", "");
  await expect(v).toHaveJSProperty("muted", true);
  await expect(v.locator('source[type="video/webm"]')).toHaveAttribute("src", "/press/demo.webm");
  await expect(page.getByRole("link", { name: /Download the video/ })).toHaveAttribute("href", "/press/demo.webm");
  const btn = page.getByRole("button", { name: "Pause video" });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(v).toHaveJSProperty("paused", true);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("demo video starts paused", async ({ page }) => {
    await page.goto("/press");
    await expect(page.getByRole("button", { name: "Pause video" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });
});

test("design page shows the sketch sheet with alt text naming all five shapes; no poll button while designPollUrl is empty", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Design explorations");
  await expect(page.locator("main")).toContainText("Prototype design, may change. Which shape would you carry?");
  const img = page.locator('main img[src="/design/form-factors.svg"]');
  await expect(img).toBeVisible();
  for (const name of ["Harmonica bar", "Snail-shell puck", "Pocket book", "Locket", "Standing stone"]) {
    await expect(img).toHaveAttribute("alt", new RegExp(name));
  }
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Vote in the poll" })).toHaveCount(0);
});

test("/today with a fixed clock shows that date's On This Day events, one fact with its source link, and one question", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 6, 4, 10, 0));
  await page.goto("/today");
  const events = JSON.parse(readFileSync("../os/spiral/builtin_scripts/on_this_day/events.json", "utf8")).filter((e: { topic: string }) => e.topic === "07-04");
  await expect(page.locator("[data-testid=today-events] li")).toHaveCount(events.length);
  await expect(page.locator("[data-testid=today-events] li").first()).toContainText(events[0].text);
  await expect(page.locator("[data-testid=today-fact] a")).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator("[data-testid=today-question]")).not.toBeEmpty();
  await expect(page.locator("main")).toContainText("July 4, 2026");
  await expect(page.getByTestId("today-credit")).toContainText("CC BY-SA 4.0");
});
