import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const shots = "design/screenshots";
const welcome = readFileSync("../os/welcome-messages.txt", "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("#"));

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
async function startFunFact(page: Page, seconds = 15) {
  await openScript(page, "Fun Fact + Question");
  if (seconds === 15) await key(page, "ArrowLeft");
  await expect(live(page)).toContainText(`Refresh: ${seconds} s`);
  await key(page, "ArrowDown"); // Mode
  await key(page, "ArrowRight"); // Quiz
  await key(page, "ArrowRight"); // Read: a fact and a question every refresh, as these tests expect
  await expect(live(page)).toContainText("Mode: Read");
  await key(page, "Enter"); // focus moves down to OK
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
}
const settle = async (page: Page) => expect(screen(page)).toHaveAttribute("data-busy", "0");

test("E2: progress stages, boot frames, welcome line 1, then line 2 after reload", async ({ page }) => {
  await page.goto("/try");
  await expect(page.getByRole("heading", { level: 1, name: "Try Spiral Node" })).toBeVisible();
  await powerOn(page);
  await expect(page.getByText("Loading Python")).toBeVisible();
  await expect(screen(page)).toHaveAttribute("data-screen", "boot", BOOT);
  await expect(live(page)).toHaveText(welcome[0]);
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
  await expect(live(page)).toHaveText(welcome[0]);
  await page.waitForTimeout(2500); // let IndexedDB sync
  await page.reload();
  await powerOn(page);
  await expect(screen(page)).toHaveAttribute("data-screen", "boot", BOOT);
  await expect(live(page)).toHaveText(welcome[1]);
});

test("E3: canvas pixels equal the OS Home still, except the clock", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/try");
  await expect(page.getByRole("button", { name: "Power on" })).toBeVisible();
  await page.screenshot({ path: `${shots}/try-desktop.png` });
  await toHome(page);
  const diff = () =>
    page.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="screen"]')!;
      const dp = c.width / 250;
      const big = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      const ref = await createImageBitmap(await (await fetch("/art/home-still.png")).blob());
      const rc = new OffscreenCanvas(250, 122);
      const rx = rc.getContext("2d")!;
      rx.drawImage(ref, 0, 0);
      const r = rx.getImageData(0, 0, 250, 122).data;
      let bad = 0;
      for (let y = 0; y < 122; y++)
        for (let x = 0; x < 250; x++) {
          if (x >= 80 && x < 170 && y < 12) continue;
          const i = ((y * dp) * c.width + x * dp) * 4;
          const j = (y * 250 + x) * 4;
          if (Math.abs(big[i] - r[j]) > 8 || Math.abs(big[i + 1] - r[j + 1]) > 8) bad++;
        }
      return bad;
    });
  await settle(page);
  await expect.poll(diff, { timeout: 15_000 }).toBe(0);
});

test("E4 + E10: keyboard-only Fun Fact flow, live text equals frame text", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/try");
  await page.getByRole("button", { name: "Power on" }).focus();
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
  await key(page, "Enter");
  await expect(live(page)).toHaveText("Menu: Scripts, Find, Chat, Quick Story, Settings, Power off. Selected: Scripts");
  await key(page, "Escape");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
  await startFunFact(page, 15);
  await expect(live(page)).toContainText("Q:", { timeout: 20_000 });
  const first = (await live(page).textContent())!;
  await expect(live(page)).not.toHaveText(first, { timeout: 20_000 });
  const second = (await live(page).textContent())!;
  expect(second).toContain("Q:");
  await settle(page);
  await page.screenshot({ path: `${shots}/try-running-desktop.png` });
  await key(page, "ArrowLeft");
  await expect(live(page)).toHaveText(first);
  await key(page, "ArrowRight");
  await expect(live(page)).toHaveText(second);
});

test("E5: hold Enter 650 ms is Back, 400 ms is select, Esc is Back", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await page.keyboard.down("Enter");
  await page.waitForTimeout(650);
  await page.keyboard.up("Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await page.keyboard.down("Enter");
  await page.waitForTimeout(400);
  await page.keyboard.up("Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "scripts");
  await key(page, "Escape");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
});

test("Backspace goes back", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await key(page, "Backspace");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test("H goes home from a running script", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await startFunFact(page);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await key(page, "h");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test("Back and Home buttons are clickable", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // the clicked Back button keeps focus
  await key(page, "Enter");
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "scripts");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test("keyboard: focus Back, press Enter goes back", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "menu");
  await page.getByRole("button", { name: "Back", exact: true }).focus();
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test("keyboard: focus Home, press Enter goes home", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "scripts");
  await page.getByRole("button", { name: "Home", exact: true }).focus();
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test.describe("E6: touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("tap segments and long-press the centre", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByRole("button", { name: "Power on" })).toBeVisible();
    await page.screenshot({ path: `${shots}/try-phone.png`, fullPage: true });
    await powerOn(page);
    await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
    const wheel = (n: string) => page.getByRole("button", { name: n, exact: true });
    // wedges are quarter triangles of a square box: tap near the outer edge, away from the centre button
    const edge = { Up: [0.5, 0.1], Down: [0.5, 0.9], Left: [0.1, 0.5], Right: [0.9, 0.5] } as const;
    const tap = async (n: keyof typeof edge) => {
      const b = (await wheel(n).boundingBox())!;
      await wheel(n).tap({ position: { x: b.width * edge[n][0], y: b.height * edge[n][1] } });
    };
    await wheel("Select (hold for Back)").tap();
    await expect(screen(page)).toHaveAttribute("data-screen", "menu");
    await tap("Down");
    await expect(live(page)).toContainText("Selected: Find");
    await tap("Up");
    await expect(live(page)).toContainText("Selected: Scripts");
    await tap("Right");
    await expect(screen(page)).toHaveAttribute("data-screen", "scripts");
    await tap("Left");
    await expect(screen(page)).toHaveAttribute("data-screen", "menu");
    const b = (await wheel("Select (hold for Back)").boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await page.waitForTimeout(750);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(screen(page)).toHaveAttribute("data-screen", "home");
  });
});

test("E7: reload keeps the same page; Reset device returns to first boot", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await startFunFact(page, 15);
  await expect(live(page)).toContainText("Q:", { timeout: 20_000 });
  const fact = (await live(page).textContent())!;
  await page.waitForTimeout(2500);
  await page.reload();
  await powerOn(page);
  await expect(screen(page)).toHaveAttribute("data-screen", "boot", BOOT);
  await expect(live(page)).toHaveText(welcome[1]);
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
  await expect(live(page)).toHaveText(fact);
  await page.getByText("Tools", { exact: true }).click();
  await page.getByRole("button", { name: "Reset device" }).click();
  await expect(page.getByText("Erase this simulated device's saved state?")).toBeVisible();
  await page.getByRole("button", { name: "Erase" }).click();
  await powerOn(page);
  await expect(screen(page)).toHaveAttribute("data-screen", "boot", BOOT);
  await expect(live(page)).toHaveText(welcome[0]);
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
  await expect(live(page)).toHaveText(welcome[0]);
});

test("?script=connect starts Connect once boot reaches Home", async ({ page }) => {
  await page.goto("/try?script=connect");
  await toHome(page);
  await expect(live(page)).toContainText("What links these?");
});

test("?script=<unknown id> boots normally to Home with no error", async ({ page }) => {
  await page.goto("/try?script=nope");
  await toHome(page);
  await expect(live(page)).toHaveText(welcome[0]);
  await expect(page.getByText("Spiral OS hit an error.")).toHaveCount(0);
});

test("E8: Power off dialog, off screen, input does nothing", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await key(page, "Enter");
  for (let i = 0; i < 5; i++) await key(page, "ArrowDown");
  await expect(live(page)).toContainText("Selected: Power off");
  await key(page, "Enter");
  await expect(live(page)).toContainText("Power off?");
  await expect(live(page)).toContainText("Selected: Cancel");
  await key(page, "ArrowRight");
  await expect(live(page)).toContainText("Selected: OK");
  await key(page, "Enter");
  await expect(screen(page)).toHaveAttribute("data-screen", "off");
  await expect(live(page)).toHaveText("Spiral Node Helix Velocities");
  await settle(page);
  const frames = await screen(page).getAttribute("data-frames");
  await key(page, "Enter");
  await key(page, "ArrowDown");
  await page.waitForTimeout(700);
  await expect(screen(page)).toHaveAttribute("data-frames", frames!);
  await expect(page.getByRole("button", { name: "Power on" })).toBeVisible();
});

test.describe("E9: reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no flash frames", async ({ page }) => {
    await page.goto("/try");
    await page.getByText("Tools", { exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Realistic e-ink" })).not.toBeChecked();
    await toHome(page);
    await key(page, "Enter");
    await expect(screen(page)).toHaveAttribute("data-screen", "menu");
    await expect(screen(page)).toHaveAttribute("data-flashes", "0");
  });
});

test("E9b: with realism on, the boot full refresh flashes", async ({ page }) => {
  await page.goto("/try");
  await page.getByText("Tools", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Realistic e-ink" })).toBeChecked();
  await toHome(page);
  // data-screen turns "home" with the frame; the ink then paper fills land over the next 400 ms.
  // On a loaded machine the next boot frame can arrive mid-plan and cancel the paper fill (a newer frame wins), so at least one flash; realism off gives exactly 0 (E9a).
  await expect.poll(async () => Number(await screen(page).getAttribute("data-flashes"))).toBeGreaterThanOrEqual(1);
});

test("error path: a failed OS download shows a device-style error, Try again recovers", async ({ page }) => {
  let blocked = true;
  await page.route("**/spiral-os.zip", (route) => (blocked ? route.abort() : route.continue()));
  await page.goto("/try");
  await powerOn(page);
  const alert = page.locator("[role=alert]", { hasText: "Spiral Node" });
  await expect(alert).toContainText("Download failed.", BOOT);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
});

test("Reset device is disabled while the simulator is loading", async ({ page }) => {
  await page.goto("/try");
  await powerOn(page);
  await page.getByText("Tools", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset device" })).toBeDisabled();
  await expect(screen(page)).toHaveAttribute("data-screen", "home", BOOT);
  await expect(page.getByRole("button", { name: "Reset device" })).toBeEnabled();
});

test("keys typed in Tools, Guide, colour and the reset dialog do not reach the device", async ({ page }) => {
  await page.goto("/try");
  await toHome(page);
  await settle(page);
  const frames = await screen(page).getAttribute("data-frames");
  await page.getByText("Tools", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Realistic e-ink" }).focus();
  await key(page, "Space");
  await page.getByText("How to use", { exact: true }).focus();
  await key(page, "Enter");
  await page.getByRole("radio", { name: "Olive" }).focus();
  await key(page, "ArrowRight");
  await expect(page.getByRole("radio", { name: "Brown" })).toBeChecked();
  await page.getByRole("button", { name: "Reset device" }).click();
  await key(page, "Escape");
  await key(page, "ArrowDown");
  await page.waitForTimeout(700);
  await expect(screen(page)).toHaveAttribute("data-frames", frames!);
  await expect(screen(page)).toHaveAttribute("data-screen", "home");
});

test.describe("phone menu screenshot", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("menu on a phone", async ({ page }) => {
    await page.goto("/try");
    await toHome(page);
    await page.getByRole("button", { name: "Select (hold for Back)" }).tap();
    await expect(screen(page)).toHaveAttribute("data-screen", "menu");
    await settle(page);
    await page.screenshot({ path: `${shots}/try-menu-phone.png`, fullPage: true });
  });
});

test("demo page ends with the launch list", async ({ page }) => {
  await page.goto("/try");
  await expect(page.getByRole("link", { name: "Join the launch list" })).toHaveAttribute("href", "/spiral-node#get-updates-h");
});
