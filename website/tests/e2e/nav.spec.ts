import { expect, test } from "@playwright/test";
import { toHold } from "./world-helpers";

const PRODUCT = "A pocket device that hands you one thing to think about.";
const hooks = [
  PRODUCT,
  "Facts, chess puzzles, poems and big questions. Try one.",
  "A fact, a question and a moment from history. New every day.",
  "Write a script and share it with other thinkers.",
  "What changed in Spiral Node, and why.",
  "Bench photos and notes as the prototype comes together.",
  "Open source. A star helps other thinkers find it.",
];
const card = (page: import("@playwright/test").Page, i: number) => page.locator(`#nav-hook-${i}`).locator("..");

test.use({ viewport: { width: 1280, height: 800 } });

test("hover shows the card after its delay", async ({ page }) => {
  await page.goto("/");
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
  await page.getByRole("link", { name: "Product", exact: true }).hover();
  await expect(card(page, 0)).toContainText(PRODUCT);
  // assert the delay itself, not a wall-clock race (the suite runs in parallel)
  await expect(card(page, 0)).toHaveCSS("transition-delay", "0.12s");
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
});

test("reduced motion keeps the show delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
  await page.getByRole("link", { name: "Product", exact: true }).hover();
  await expect(card(page, 0)).toHaveCSS("transition-delay", "0.12s");
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
});

test("reduced motion: Escape hides the card at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "Product", exact: true }).hover();
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(card(page, 0)).toHaveCSS("transition-delay", "0s");
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
});

test("after a click, hovering the link again shows its card", async ({ page }) => {
  await page.goto("/");
  const product = page.getByRole("link", { name: "Product", exact: true });
  await product.click();
  await page.waitForURL("**/spiral-node");
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
  await page.mouse.move(5, 500); // away from the header
  await product.hover();
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
});

test("the card is shut after opening its link with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Product", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/spiral-node");
  await page.waitForTimeout(400);
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
});

test("the card stays open while the pointer is on it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Product", exact: true }).hover();
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
  await card(page, 0).hover();
  await page.waitForTimeout(400);
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
});

test("keyboard focus shows it, Escape hides it, the next link shows its own", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Spiral Node", exact: true }).focus();
  await page.keyboard.press("Tab");
  const product = page.getByRole("link", { name: "Product", exact: true });
  await expect(product).toBeFocused();
  await expect(card(page, 0)).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(card(page, 0)).toHaveCSS("opacity", "0");
  await expect(product).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(card(page, 1)).toHaveCSS("opacity", "1");
});

test("the link name stays plain and the hook is its description", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Product", exact: true });
  await expect(link).toHaveCount(1);
  const id = await link.getAttribute("aria-describedby");
  await expect(page.locator(`#${id}`)).toHaveText(PRODUCT);
});

for (const width of [760, 1024, 1280]) {
  test(`every card stays on screen at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    for (let i = 0; i < hooks.length; i++) {
      await page.locator("#site-nav a").nth(i).hover();
      await expect(card(page, i)).toHaveCSS("opacity", "1");
      const box = (await card(page, i).boundingBox())!;
      expect(box.x, `card ${i}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `card ${i}`).toBeLessThanOrEqual(width);
    }
  });
}

test("reduced motion has no slide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "Product", exact: true }).hover();
  await expect(card(page, 0)).toBeVisible();
  await expect(card(page, 0)).toHaveCSS("transform", "none");
});

test("phone menu shows hooks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  for (let i = 0; i < hooks.length; i++) {
    await expect(page.locator(`#nav-hook-${i}`)).toBeVisible();
    await expect(page.locator(`#nav-hook-${i}`)).toHaveText(hooks[i]);
    await expect(card(page, i).locator("[data-emblem]")).toBeHidden();
  }
});

test.describe("header during the story", () => {
  const navLinks = (page: import("@playwright/test").Page) => page.locator("#site-nav a");
  const spiral = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^(Show|Hide) links$/ });
  const toScene = async (page: import("@playwright/test").Page, id: string) => {
    await page.locator(`section[data-scene="${id}"]`).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 1));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  };

  test("at the top the seven links are visible", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 7; i++) await expect(navLinks(page).nth(i)).toBeVisible();
    await expect(spiral(page)).toHaveCount(0);
  });

  test("inside the story the links step aside and the spiral brings them back", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await expect(navLinks(page).first()).toBeHidden();
    await expect(spiral(page)).toBeVisible();
    await spiral(page).click();
    for (let i = 0; i < 7; i++) await expect(navLinks(page).nth(i)).toBeVisible();
  });

  test("at the last scene the links are visible again", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await expect(navLinks(page).first()).toBeHidden();
    await toScene(page, "s9");
    await expect(navLinks(page).first()).toBeVisible();
    await expect(spiral(page)).toHaveCount(0);
  });

  test("on a phone the spiral opens the menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).click();
    await expect(page.locator("#nav-hook-0")).toBeVisible();
  });

  test("Tab from the page top reaches Product", async ({ page }) => {
    await page.goto("/");
    const product = page.getByRole("link", { name: "Product", exact: true });
    for (let i = 0; i < 6 && !(await product.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(product).toBeFocused();
  });

  test("other pages always show the links", async ({ page }) => {
    await page.goto("/scripts");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    for (let i = 0; i < 7; i++) await expect(navLinks(page).nth(i)).toBeVisible();
    await expect(page.locator("header:has(#site-nav)")).toHaveCSS("position", "static");
    await expect(spiral(page)).toHaveCount(0);
  });

  test("a focused header link stays visible while the story scrolls", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Product", exact: true }).focus();
    await toScene(page, "s3");
    await expect(page.getByRole("link", { name: "Product", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Product", exact: true })).toBeFocused();
  });

  test("keyboard: the spiral is reachable and Enter shows the links", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).focus();
    await page.keyboard.press("Enter");
    await expect(navLinks(page).first()).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Spiral Node", exact: true })).toBeFocused();
  });

  test("a revealed header steps aside again after scrolling on", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).click();
    await expect(navLinks(page).first()).toBeVisible();
    await page.mouse.move(640, 500);
    await page.mouse.wheel(0, 300);
    await expect(navLinks(page).first()).toBeHidden();
  });

  test("after a mouse click on Hide links the header stays hidden on scroll", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).click();
    await expect(navLinks(page).first()).toBeVisible();
    await page.getByRole("button", { name: "Hide links" }).click();
    await expect(navLinks(page).first()).toBeHidden();
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 80);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await expect(navLinks(page).first()).toBeHidden();
  });

  const twoFrames = (page: import("@playwright/test").Page) =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

  test("keyboard: Hide links on the spiral holds while scrolling", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).focus();
    await page.keyboard.press("Enter");
    await expect(navLinks(page).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Show links" })).toBeVisible();
    await expect(navLinks(page).first()).toBeHidden();
    await page.mouse.move(640, 500);
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 80);
    await twoFrames(page);
    await expect(navLinks(page).first()).toBeHidden();
  });

  test("keyboard: Show links on the spiral holds while scrolling", async ({ page }) => {
    await page.goto("/");
    await toScene(page, "s3");
    await spiral(page).focus();
    await page.keyboard.press("Enter");
    await expect(navLinks(page).first()).toBeVisible();
    await page.mouse.move(640, 500);
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 80);
    await twoFrames(page);
    await expect(navLinks(page).first()).toBeVisible();
  });

  test("a mouse tap on Menu at the top does not pin the header during the story", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const menu = page.locator('header button[aria-controls="site-nav"]');
    await menu.click();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await toScene(page, "s3");
    await expect(page.locator("header").getByRole("link", { name: "Spiral Node", exact: true })).toBeHidden();
    await expect(spiral(page)).toBeVisible();
  });

  test("leaving the story by a link restores the normal header", async ({ page }) => {
    await page.goto("/?scene=sunset");
    await toHold(page, "s5");
    await page.locator('section[data-scene="s5"]').getByRole("link", { name: "See more scripts" }).click();
    await page.waitForURL("**/scripts");
    await expect(page.locator("header:has(#site-nav)")).toHaveCSS("position", "static");
    for (let i = 0; i < 7; i++) await expect(navLinks(page).nth(i)).toBeVisible();
    await expect(spiral(page)).toHaveCount(0);
  });

  test("the story page header is fixed from the first paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header:has(#site-nav)")).toHaveCSS("position", "fixed");
  });
});

test("header links sit in paper boxes", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("navigation").getByRole("link", { name: "Scripts" });
  expect(await link.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(241, 231, 204)");
  expect(await link.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(28, 26, 20)");
});

test("the demo button is the one orange button and bobs, except under reduced motion", async ({ page }) => {
  await page.goto("/scripts");
  const cta = page.locator("#site-nav a", { hasText: "Try the demo" });
  expect(await cta.evaluate((e) => getComputedStyle(e).animationName)).toMatch(/bob/);
  expect(await cta.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(240, 118, 46)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await cta.evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});

test("focus rings are 2 px gold", async ({ page }) => {
  await page.goto("/scripts");
  const link = page.getByRole("navigation").getByRole("link", { name: "Scripts" });
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  expect(await link.evaluate((e) => getComputedStyle(e).outlineColor)).toBe("rgb(233, 168, 32)");
  expect(await link.evaluate((e) => getComputedStyle(e).outlineWidth)).toBe("2px");
});

test("the paper grain is one fixed layer that ignores the pointer", async ({ page }) => {
  await page.goto("/scripts");
  const g = page.locator("[data-grain]");
  await expect(g).toHaveCount(1);
  await expect(g).toHaveAttribute("aria-hidden", "true");
  expect(await g.evaluate((e) => [getComputedStyle(e).position, getComputedStyle(e).pointerEvents])).toEqual(["fixed", "none"]);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--grain"))).toContain("data:image/png");
});

test("a focused header link keeps its ink halo around the gold ring", async ({ page }) => {
  await page.goto("/scripts");
  const link = page.getByRole("navigation").getByRole("link", { name: "Scripts" });
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  expect(await link.evaluate((e) => getComputedStyle(e).boxShadow)).toContain("rgb(28, 26, 20) 0px 0px 0px 11px");
  expect(await link.evaluate((e) => getComputedStyle(e).outlineOffset)).toBe("7px");
});
