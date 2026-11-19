// Measures the hero device + "Try it right here" button in art px at two viewports; writes art/keepout.json.
// Usage: serve the built site (npx vite preview --outDir out --port 3101), then: node art/measure_keepout.mjs http://localhost:3101
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const browser = await chromium.launch();
let u = null;
const boxesOut = [];
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await page.goto(base);
  await page.waitForLoadState("networkidle");
  const boxes = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return [b.x, b.y, b.right, b.bottom]; };
    const img = document.querySelector("img[class*=scene]").getBoundingClientRect();
    const k = img.width / 320;
    const els = [document.querySelector("main img[src*='hero-device']"), [...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Try it right here"))];
    return els.map((e) => r(e)).map(([x0, y0, x1, y1]) => [(x0 - img.x) / k, (y0 - img.y) / k, (x1 - img.x) / k, (y1 - img.y) / k]);
  });
  for (const b of boxes) boxesOut.push({ x: Math.max(0, Math.floor(b[0])), y: Math.max(0, Math.floor(b[1])), w: Math.min(320, Math.ceil(b[2])) - Math.max(0, Math.floor(b[0])), h: Math.min(180, Math.ceil(b[3])) - Math.max(0, Math.floor(b[1])) });
  for (const b of boxes) u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b;
  console.log(w, h, JSON.stringify(boxes));
  await page.close();
}
await browser.close();
const [x0, y0, x1, y1] = [Math.max(0, Math.floor(u[0])), Math.max(0, Math.floor(u[1])), Math.min(320, Math.ceil(u[2])), Math.min(180, Math.ceil(u[3]))];
// keepOut is the bounding union; boxes are the four real rectangles (device and button at each viewport), which the tests use.
const keepOut = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, boxes: boxesOut };
writeFileSync(new URL("./keepout.json", import.meta.url), JSON.stringify(keepOut));
console.log(keepOut);
