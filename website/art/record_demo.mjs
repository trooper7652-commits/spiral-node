// Records the press demo video (public/press/demo.webm) and poster (public/press/demo-poster.png).
//
// How to run, from website/:
//   npm run build                                   # writes the static export to out/
//   npm run start -- --port 3111 --strictPort &     # serves out/ (the same server playwright.config.ts uses)
//   node art/record_demo.mjs http://localhost:3111
// Needs ffmpeg on PATH (to trim the loading screens and re-encode). Layout and moves are deterministic. The page clock is fixed, but the simulator runs in a Web Worker, so the device clock shows the real time.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://localhost:3111").replace(/\/$/, "");
const press = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "press");
mkdirSync(press, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "demo-"));

const t0 = Date.now();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.clock.install({ time: new Date("2026-11-17T09:41:00") });
const screen = page.getByTestId("screen");
const live = page.getByTestId("live");
const key = (k) => page.keyboard.press(k);
const wait = (ms) => page.waitForTimeout(ms);
const frameDevice = () => screen.evaluate((c) => c.scrollIntoView({ block: "center" }));
const onScreen = (name) => page.waitForFunction((n) => document.querySelector('[data-testid="screen"]')?.getAttribute("data-screen") === n, name, { timeout: 90_000 });

// The fixed clock is paused until advanced, so tick it along in real time while recording.
const ticker = setInterval(() => page.clock.runFor(100).catch(() => {}), 100);

await page.goto(`${base}/try?script=chess_puzzles`);
await wait(1500);
await page.getByRole("button", { name: "Power on" }).click();
await onScreen("home");
const bootEnd = () => (Date.now() - t0) / 1000;
await page.waitForFunction(() => /\S/.test(document.querySelector('[data-testid="live"]')?.textContent ?? ""));
await frameDevice();
const cutAt = Math.max(0, bootEnd() - 0.2); // seconds of boot and loading to drop from the head of the video
await wait(2500);
await page.screenshot({ path: join(press, "demo-poster.png") });
for (let i = 0; i < 3; i++) {
  await key("ArrowRight"); // next puzzle / move
  await wait(2400);
}
await key("ArrowLeft");
await wait(2500);

// Poems through the device menu: Home, Menu, Scripts (Chess, Connect, Fun Fact, Poems), prefs, OK.
await key("Enter");
await onScreen("menu");
await wait(900);
await key("Enter");
await onScreen("scripts");
await wait(900);
for (let i = 0; i < 3; i++) {
  await key("ArrowDown");
  await wait(500);
}
await key("Enter");
await onScreen("prefs");
await wait(900);
await key("Enter"); // focus moves down to OK
await key("Enter");
await onScreen("home");
await wait(2600);
for (let i = 0; i < 2; i++) {
  await key("ArrowRight");
  await wait(2600);
}
await wait(1500);
clearInterval(ticker);
const vid = page.video();
await context.close();
await browser.close();
// Drop the loading screens, re-encode small (VP9, 1280x720).
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", cutAt.toFixed(2), "-i", await vid.path(), "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-r", "25", join(press, "demo.webm")]);
rmSync(tmp, { recursive: true, force: true });
console.log("wrote public/press/demo.webm and demo-poster.png");
