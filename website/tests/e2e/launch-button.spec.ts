import { test, expect } from "@playwright/test";

test("the header's launch list button is ink and gold and opens the welcome dialog, also after Skip", async ({ page }) => {
  await page.goto("/scripts");
  const btn = page.getByRole("button", { name: "Join the launch list" });
  await expect(btn).toBeVisible();
  expect(await btn.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(28, 26, 20)");
  expect(await btn.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(233, 168, 32)");

  await btn.click();
  const dialog = page.getByTestId("welcome-popup");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toBeHidden();

  // a skipped popup never returns by itself, but the button still opens it, by keyboard too
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
});

test("the launch list button does not overlap its neighbours at 1280 and 1024", async ({ page }) => {
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/scripts");
    const btn = await page.getByRole("button", { name: "Join the launch list" }).boundingBox();
    const demo = await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Try the demo" }).boundingBox();
    const github = await page.getByRole("link", { name: "Star Spiral Node on GitHub" }).boundingBox();
    expect(btn!.x + btn!.width, `demo button at ${width}`).toBeLessThanOrEqual(demo!.x);
    expect(github!.x + github!.width, `GitHub box at ${width}`).toBeLessThanOrEqual(btn!.x);
    expect(demo!.x + demo!.width, `inside the screen at ${width}`).toBeLessThanOrEqual(width);
  }
});

test("on a phone the launch list button is in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scripts");
  await page.getByRole("button", { name: "Menu" }).click();
  const btn = page.getByRole("button", { name: "Join the launch list" });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByTestId("welcome-popup")).toBeVisible();
});
