import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const paths = ["/?scene=sunset", "/?scene=night", "/try", "/scripts", "/scripts/chess_puzzles", "/write", "/contest", "/changelog", "/press", "/company", "/devlog", "/today", "/design", "/spiral-node", "/follow", "/credits", "/build-log", "/founder", "/devlog/2026-11-16-open-source"];

// With no scene drawn yet the sections are plain content in flow, and a slow load can leave the page in that state.
test("no serious or critical axe violations on / before the first frame", async ({ page }) => {
  await page.route("**/*.webp", () => {});
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?scene=sunset", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-hold]").first()).toBeVisible();
  await expect(page.locator("[data-live]")).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});

for (const path of paths) {
  test(`no serious or critical axe violations on ${path}`, async ({ page }) => {
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    for (const v of bad) {
      console.log(`${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(bad.map((v) => v.id)).toEqual([]);
  });
}
