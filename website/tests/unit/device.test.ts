import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const art = resolve(__dirname, "../../public/art");
const meta = JSON.parse(readFileSync(resolve(art, "device.json"), "utf8"));

it("device art is a landscape pager with a 250x122 screen, Back/Home keys bottom left and the wheel bottom right", () => {
  expect(meta.screen.w).toBe(250);
  expect(meta.screen.h).toBe(122);
  expect(meta.width).toBeGreaterThan(meta.height);
  expect(meta.wheel.cy - meta.wheel.r).toBeGreaterThan(meta.screen.y + meta.screen.h);
  expect(meta.wheel.cx).toBeGreaterThan(meta.width / 2);
  for (const k of [meta.keys.back, meta.keys.home]) {
    expect(k.y).toBeGreaterThan(meta.screen.y + meta.screen.h);
    expect(k.x + k.w).toBeLessThan(meta.wheel.cx - meta.wheel.r);
  }
  expect(meta.keys.back.x + meta.keys.back.w).toBeLessThan(meta.keys.home.x);
});

it("art/device-layout.json gives the screen and keys as percentages of the image", () => {
  const lay = JSON.parse(readFileSync(resolve(__dirname, "../../art/device-layout.json"), "utf8"));
  expect(lay.screen.w).toBeCloseTo((250 / meta.width) * 100, 1);
  expect(lay.screen.h).toBeCloseTo((122 / meta.height) * 100, 1);
  expect(lay.back.x).toBeLessThan(lay.home.x);
});

it("the left side face has only a USB-C port, a charge light and a power button", () => {
  expect(Object.keys(meta.side).sort()).toEqual(["height", "light", "power", "usb", "width"]);
});

it("device-olive.png is as big as device.json says", () => {
  const png = readFileSync(resolve(art, "device-olive.png"));
  expect(png.readUInt32BE(16)).toBe(meta.width);
  expect(png.readUInt32BE(20)).toBe(meta.height);
});
