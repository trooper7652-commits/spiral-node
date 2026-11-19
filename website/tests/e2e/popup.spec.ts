import { expect, test } from "@playwright/test";

test("?popup=now shows the dialog; subscribing turns it into the star ask; Esc closes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"stargazers_count":3}' }));
  await page.goto("/?popup=now");
  const d = page.getByTestId("signup-popup");
  await expect(d).toBeVisible();
  await expect(d).toContainText("Get Spiral Node updates");
  expect(await d.evaluate((e) => e.matches(":modal"))).toBe(true);
  await d.getByLabel("Email").fill("reader@example.com");
  await d.getByRole("button", { name: "Subscribe" }).click();
  await expect(d).toContainText("Thanks! Check your inbox to confirm.");
  await expect(d).toContainText("One more thing: star Spiral Node on GitHub.");
  await expect(d.getByRole("link", { name: "Star on GitHub" })).toHaveAttribute("target", "_blank");
  await expect(d).toContainText("3 stars");
  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
});

test("on a 360 px phone the popup is a bottom card and the page stays usable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/?popup=now");
  const d = page.getByTestId("signup-popup");
  await expect(d).toBeVisible();
  expect(await d.evaluate((e) => e.matches(":modal"))).toBe(false);
  const box = (await d.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(740 - 16);
  expect(box.height).toBeLessThan(740 / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await d.getByRole("button", { name: "Close" }).click();
  await expect(d).toBeHidden();
});

test("/try?popup=now shows nothing", async ({ page }) => {
  await page.goto("/try?popup=now");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("signup-popup")).toBeHidden();
});

test("without a form URL and without ?popup=now, nothing shows", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.clock.runFor(65_000);
  await expect(page.getByTestId("signup-popup")).toBeHidden();
});
