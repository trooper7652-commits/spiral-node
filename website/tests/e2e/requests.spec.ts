import { expect, test } from "@playwright/test";
import { SITE } from "../../lib/site";

// A first visit: the opening and the popup are live.
test.use({ storageState: { cookies: [], origins: [] } });

const PATHS = [
  "/", "/spiral-node", "/design", "/try", "/scripts", "/scripts/chess_puzzles", "/write", "/today",
  "/devlog", "/devlog/2026-11-16-open-source", "/build-log", "/changelog",
  "/company", "/founder", "/press", "/credits", "/contest", "/follow",
];

// The site's only outside requests: the launch-list form post to Kit, and one GitHub call for the star count.
test("no request leaves the site except the Kit post and the star count", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const home = new URL(baseURL!).origin;
  const logged: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(home) && !u.startsWith("data:") && !u.startsWith("blob:")) logged.push(`${r.method()} ${u}`);
  });
  // a stray request is logged but never really sent; the last route registered is tried first, so the two allowed hosts get their stubs
  await page.route((u) => u.origin !== home, (r) => r.abort());
  await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"stargazers_count":3}' }));

  for (const path of PATHS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  // the whole home world, so every scene and join loads
  await page.goto("/");
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= max; y += 600) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
  await page.waitForLoadState("networkidle");

  // the popup, sent
  await page.goto("/?popup=now");
  const d = page.getByTestId("welcome-popup");
  await d.getByLabel("Email").fill("test@example.com");
  await d.getByRole("button", { name: "Send" }).click();
  await expect(d).toContainText("Thanks! Check your inbox to confirm.");
  await page.waitForLoadState("networkidle");

  const allowed = [`POST ${SITE.newsletterFormUrl}`, `GET ${SITE.repoApi}`];
  expect(logged.filter((x) => !allowed.includes(x))).toEqual([]);
  for (const a of allowed) expect(logged, a).toContain(a);
});
