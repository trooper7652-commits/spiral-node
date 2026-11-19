import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// /today and /design are added here when those pages are built.
const paths = ["/", "/try", "/scripts", "/scripts/chess_puzzles", "/write", "/contest", "/changelog", "/press", "/company", "/devlog"];

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
