import { expect, test, type Page } from "@playwright/test";

test.setTimeout(150_000);

const live = (page: Page) => page.getByTestId("live");
const screen = (page: Page) => page.getByTestId("screen");
const key = (page: Page, k: string) => page.keyboard.press(k);
const BOOT = { timeout: 60_000 };

async function powerOn(page: Page) {
  await page.getByRole("button", { name: "Power on" }).click();
}
async function toHome(page: Page) {
  await powerOn(page);
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
}
async function openScript(page: Page, name: string) {
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "scripts");
  for (let i = 0; i < 20; i++) {
    const text = (await live(page).textContent()) ?? "";
    if (text.includes(`Selected: ${name}`)) break;
    await key(page, "ArrowDown");
    await expect(live(page)).not.toHaveText(text); // wait for the move to land before reading again
  }
  await expect(live(page)).toContainText(`Selected: ${name}`);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "prefs");
  await expect(live(page)).toContainText(name);
}

test("Daily Puzzle: pick an answer with Right and Select", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await openScript(page, "Daily Puzzle");
  await key(page, "Enter"); // focus moves down to OK
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
  await expect(live(page)).toContainText("Today's puzzle");
  await expect(live(page)).toContainText("Choices: [A], B, C");
  await key(page, "ArrowRight");
  await expect(live(page)).toContainText("Choices: A, [B], C");
  await key(page, "Enter");
  await expect(live(page)).toHaveText(/^(Right|Not quite)\b/);
});

test("Back on a waiting question opens the menu, which lists Find", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await openScript(page, "Daily Puzzle");
  await key(page, "Enter");
  await key(page, "Enter");
  await expect(live(page)).toContainText("Choices: [A], B, C");
  await key(page, "Escape");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await expect(live(page)).toContainText("Menu: Scripts, Find, Chat");
});
