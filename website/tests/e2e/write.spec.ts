import { expect, test, type Page } from "@playwright/test";

test.setTimeout(150_000);

const BOOT = { timeout: 60_000 };
const alert = (page: Page) => page.locator("pre[role=alert]");
const editor = (page: Page) => page.getByLabel("Script source (Python)");

test("run a valid script shows its page on the sim screen", async ({ page }) => {
  await page.goto("/write");
  await expect(page.getByRole("heading", { level: 1, name: "Write a script" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeEnabled(BOOT);
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("live")).toContainText(/Wombat|flamingos|Sharks/, BOOT);
  await expect(page.getByTestId("screen")).toHaveAttribute("data-screen", "home");
  await expect(alert(page)).toHaveCount(0);
});

test("a broken script shows the loader error", async ({ page }) => {
  await page.goto("/write");
  await expect(page.getByRole("button", { name: "Run" })).toBeEnabled(BOOT);
  await editor(page).fill("this is not python (");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(alert(page)).toContainText("SyntaxError", BOOT);
});

test("a long script offers Download instead of Submit", async ({ page }) => {
  await page.goto("/write");
  await expect(page.getByRole("button", { name: "Submit to the gallery" })).toBeVisible();
  await editor(page).fill('NAME = "Long"\n' + "# padding\n".repeat(1000));
  await expect(page.getByRole("button", { name: "Submit to the gallery" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download script.py" })).toBeVisible();
  await expect(page.getByText("This script is too long to submit from the browser. Download it and follow the contributing guide.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Contributing guide" })).toHaveAttribute("href", /\/blob\/main\/CONTRIBUTING\.md$/);
});
