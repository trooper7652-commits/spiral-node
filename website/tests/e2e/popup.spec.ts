import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SITE } from "../../lib/site";
import { toHold } from "./world-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("shows when scene 2 is reached, not before", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const d = page.getByTestId("welcome-popup");
  // the story is up (it announces its scene) and has not reached scene 2: no dialog
  await expect(page.locator("html")).toHaveAttribute("data-sn-scene", /^-?[01]$/);
  await page.waitForTimeout(1500);
  await expect(d).toBeHidden();

  // reach scene 2
  await toHold(page, "s2");
  await expect(d).toBeVisible();
  await expect(d.getByRole("heading", { name: "Welcome" })).toBeVisible();
});

test("only email is required; Skip and Escape close it for good", async ({ page, context }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();

  // Send with empty email is blocked by browser validation (:invalid)
  const sendBtn = d.getByRole("button", { name: "Send" });
  await sendBtn.click();
  await expect(d).toBeVisible();

  // Fill only email and send
  await d.getByLabel("Email").fill("test@example.com");
  await sendBtn.click();
  await expect(d).toContainText("Thanks! Check your inbox to confirm.");

  // The thanks state has Close, not Skip
  await d.getByRole("button", { name: "Close" }).click();
  await expect(d).toBeHidden();

  // Reload -> still closed
  // (?popup=now is a review mode and would reopen it, so check the stored answer and a plain reload)
  expect(await page.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("sent");
  await page.goto("/");
  await toHold(page, "s2");
  await expect(page.locator("html")).toHaveAttribute("data-sn-scene", "1");
  await expect(d).toBeHidden();

  // Fresh context + Escape -> closed for good too
  const page2 = await context.newPage();
  await page2.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
  await page2.goto("/?popup=now");
  const d2 = page2.getByTestId("welcome-popup");
  await expect(d2).toBeVisible();
  await page2.keyboard.press("Escape");
  await expect(d2).toBeHidden();
  // same context, so the earlier "sent" stays (a review-mode Escape never downgrades it); "Escape on the form writes 'skipped'" covers the fresh case
  expect(await page2.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("sent");
});

test("keeps answers on failure", async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.abort());
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();

  await d.getByLabel("First name").fill("Alice");
  await d.getByLabel("Email").fill("alice@example.com");
  await d.getByRole("button", { name: "Send" }).click();

  const alert = d.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Couldn.t send that\. Try again\?/);

  expect(await d.getByLabel("First name").inputValue()).toBe("Alice");
  expect(await d.getByLabel("Email").inputValue()).toBe("alice@example.com");

  await d.getByRole("button", { name: "Skip" }).click();
  await expect(d).toBeHidden();
});

test("a hung Kit reply ends in the alert; answers kept; Skip works", async ({ page }) => {
  await page.route("https://app.kit.com/**", () => new Promise(() => {})); // never answers
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();
  await d.getByLabel("First name").fill("Bo");
  await d.getByLabel("Email").fill("bo@example.com");
  await d.getByRole("button", { name: "Send" }).click();
  await expect(d.getByRole("alert")).toBeVisible({ timeout: 15_000 });
  expect(await d.getByLabel("First name").inputValue()).toBe("Bo");
  expect(await d.getByLabel("Email").inputValue()).toBe("bo@example.com");
  await d.getByRole("button", { name: "Skip" }).click();
  await expect(d).toBeHidden();
});

test("a footer sign-up means the popup never shows at scene 2", async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
  await page.goto("/company");
  const footer = page.locator("footer");
  await footer.getByLabel("Email").fill("foot@example.com");
  await footer.getByRole("button", { name: "Subscribe" }).click();
  await expect(footer.getByRole("status")).toContainText("Thanks");
  expect(await page.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("sent");
  await page.goto("/");
  await toHold(page, "s2");
  await expect(page.locator("html")).toHaveAttribute("data-sn-scene", "1");
  await expect(page.getByTestId("welcome-popup")).toBeHidden();
});

test("sends once on double click", async ({ page }) => {
  let posts = 0;
  await page.route("https://app.kit.com/**", async (r) => {
    posts++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await r.fulfill({ status: 200, body: "{}" });
  });
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();

  await d.getByLabel("Email").fill("double@example.com");
  const sendBtn = d.getByRole("button", { name: "Send" });
  await sendBtn.dblclick();
  // two submits in the same tick: only the ref guard stops the second (React state is still stale)
  await d.locator("form").evaluate((f) => { (f as HTMLFormElement).requestSubmit(); (f as HTMLFormElement).requestSubmit(); }).catch(() => {});

  await expect(d).toContainText("Thanks! Check your inbox to confirm.");
  await page.waitForTimeout(500);
  expect(posts).toBe(1);
});

test("thanks state has a Close button; Close and Escape after sending keep 'sent'", async ({ page }) => {
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, body: "{}" }));
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await d.getByLabel("Email").fill("a@example.com");
  await d.getByRole("button", { name: "Send" }).click();
  await expect(d).toContainText("Thanks! Check your inbox to confirm.");
  await d.getByRole("button", { name: "Close" }).click();
  await expect(d).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("sent");

  await page.goto("/?popup=now");
  await d.getByLabel("Email").fill("b@example.com");
  await d.getByRole("button", { name: "Send" }).click();
  await expect(d).toContainText("Thanks!");
  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("sent");
});

test("Escape on the form writes 'skipped' once", async ({ page }) => {
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("sn-welcome"))).toBe("skipped");
});

test("other pages: the old timing applies (60 s of visible time)", async ({ page }) => {
  test.skip(!SITE.newsletterFormUrl, "no form URL: nothing shows, see the next test");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/company");
  await page.waitForTimeout(1000); // real time: let React hydrate so the effect's interval exists before the fake clock runs
  await page.clock.runFor(30_000);
  await expect(page.getByTestId("welcome-popup")).toBeHidden();
  await page.clock.runFor(35_000);
  await expect(page.getByTestId("welcome-popup")).toBeVisible();
});

test("without a form URL and without ?popup=now, nothing shows", async ({ page }) => {
  test.skip(!!SITE.newsletterFormUrl, "a form URL is set; covered by the timing test above and tests/unit/popup.test.ts");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/company");
  await page.clock.runFor(65_000);
  await expect(page.getByTestId("welcome-popup")).toBeHidden();
});

test("it is a proper dialog and passes axe", async ({ page }) => {
  // Open by the 60 s rule (fake clock) so a page element can hold focus first.
  test.skip(!SITE.newsletterFormUrl, "the timed rule needs a form URL");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/company");
  await page.waitForTimeout(1000); // real time: let React hydrate
  const trigger = page.getByRole("link").first();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.clock.runFor(65_000);
  const d = page.getByRole("dialog", { name: "Welcome" });
  await expect(d).toBeVisible();
  expect(await d.evaluate((e) => e.matches(":modal"))).toBe(true);

  // focus is inside on open
  const inside = () => d.evaluate((e) => e.contains(document.activeElement));
  expect(await inside()).toBe(true);

  // Tab and Shift+Tab never reach the page behind (First name, Email, Send, Skip: more presses than controls).
  // A native modal lets focus step out to the browser's own controls after the last one (the page then reports body); the page itself stays inert.
  const notBehind = () => d.evaluate((e) => e.contains(document.activeElement) || document.activeElement === document.body);
  const seen = new Set<boolean>();
  for (const k of [...Array(6).fill("Tab"), ...Array(6).fill("Shift+Tab")]) {
    await page.keyboard.press(k);
    expect(await notBehind()).toBe(true);
    seen.add(await inside());
  }
  expect(seen.has(true)).toBe(true); // it cycles through the dialog's own controls

  // axe while the dialog is open
  const results = await new AxeBuilder({ page }).include('[data-testid="welcome-popup"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => v.id)).toEqual([]);

  await d.getByRole("button", { name: "Skip" }).click();
  await expect(d).toBeHidden();
  await expect(trigger).toBeFocused(); // focus returns to where it was
});

test("/try?popup=now and /spiral-node?popup=now show nothing", async ({ page }) => {
  await page.goto("/try?popup=now");
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("welcome-popup")).toBeHidden();

  await page.goto("/spiral-node?popup=now");
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("welcome-popup")).toBeHidden();
});

test("/company?popup=now shows it and 360 px phone fits without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/company?popup=now");
  const d = page.getByTestId("welcome-popup");
  await expect(d).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const box = (await d.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(740);
  await d.getByRole("button", { name: "Skip" }).click();
  await expect(d).toBeHidden();
});


for (const path of ["/?popup=now", "/scripts?popup=now"])
  test(`the page holds still behind the open popup (${path})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await expect(page.getByTestId("welcome-popup")).toBeVisible();
    await page.mouse.move(640, 790); // the backdrop, below the dialog
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
