import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { initialScene, nextWait, other } from "../../lib/scenes";
import art from "../../public/art/scene.json";

/** Minimal PNG reader (8-bit RGB/RGBA, non-interlaced) so the test needs no new dependency. */
function readPng(path: string) {
  const buf = readFileSync(path);
  let width = 0, height = 0, bpp = 4;
  const idat: Buffer[] = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bpp = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? data[y * stride + x - bpp] : 0;
      const b = y ? data[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? data[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      data[y * stride + x] = (v + [0, a, b, (a + b) >> 1, paeth][f]) & 255;
    }
  }
  return { width, bpp, data };
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("scenes", () => {
  it("nextWait stays within 3000-8000 ms and varies", () => {
    const r = seeded(42);
    const waits = Array.from({ length: 1000 }, () => nextWait(r));
    expect(waits.every((w) => w >= 3000 && w <= 8000)).toBe(true);
    expect(new Set(waits).size).toBeGreaterThan(900);
  });
  it("nextWait maps the rand extremes", () => {
    expect(nextWait(() => 0)).toBe(3000);
    expect(nextWait(() => 0.5)).toBe(5500);
  });
  it("initialScene is sunset either way", () => {
    expect(initialScene(true)).toBe("sunset");
    expect(initialScene(false)).toBe("sunset");
  });
  it("other flips the scene", () => {
    expect(other("sunset")).toBe("night");
    expect(other("night")).toBe("sunset");
  });
  it("scenes differ in the land region", () => {
    const art = (f: string) => {
      const png = readPng(join(__dirname, "../../public/art", f));
      return (y0: number, y1: number) => {
        const s = [0, 0, 0];
        let n = 0;
        for (let y = y0; y < y1; y++)
          for (let x = 0; x < png.width; x++) {
            const i = (y * png.width + x) * png.bpp;
            for (let c = 0; c < 3; c++) s[c] += png.data[i + c];
            n++;
          }
        return s.map((v) => v / n);
      };
    };
    const night = art("scene-night.png");
    const sunset = art("scene-sunset.png");
    const [a, b] = [night(110, 180), sunset(110, 180)];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(60);
    const lin = (v: number) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const [r, g, bl] = night(0, 61);
    expect(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl)).toBeLessThan(0.12);
  });
});

type Animal = { testId: string; x: number; y: number; w: number; h: number; frames: number; kind: "idle" | "flyer" | "blink" | "still" };
const animals = (scene: "sunset" | "night") => (art[scene] as unknown as { animals: Animal[] }).animals;
const ids = (scene: "sunset" | "night") => animals(scene).map((a) => a.testId);
const keep = art.keepOut as { boxes: { x: number; y: number; w: number; h: number }[] };

describe("scene cast", () => {
  it("animals stay in the canvas", () => {
    for (const scene of ["sunset", "night"] as const)
      for (const a of animals(scene)) {
        expect(a.x, a.testId).toBeGreaterThanOrEqual(0);
        expect(a.y, a.testId).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w, a.testId).toBeLessThanOrEqual(320);
        expect(a.y + a.h, a.testId).toBeLessThanOrEqual(180);
      }
  });
  it("idle and blink animals avoid keepOut", () => {
    expect(keep.boxes.length).toBeGreaterThanOrEqual(4);
    for (const scene of ["sunset", "night"] as const)
      for (const a of animals(scene).filter((a) => a.kind !== "flyer"))
        for (const b of keep.boxes)
          expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${scene} ${a.testId}`).toBe(false);
  });
  it("sunset cast", () => {
    expect(ids("sunset")).toEqual(expect.arrayContaining(["butterfly-1", "butterfly-2", "dog", "deer-doe", "deer-fawn", "frog-1", "frog-2", "toad", "robin", "cardinal", "rabbit", "squirrel", "thinker"]));
  });
  it("night cast", () => {
    const fireflies = Array.from({ length: 8 }, (_, i) => `firefly-${i + 1}`);
    expect(ids("night")).toEqual(expect.arrayContaining(["dog-asleep", "owl", ...fireflies, "bat-1", "bat-2", "deer-night", "fox", "frog-1", "toad", "thinker"]));
  });
  it("at most 16 animated sprites per scene", () => {
    for (const scene of ["sunset", "night"] as const) expect(animals(scene).filter((a) => a.kind !== "still").length).toBeLessThanOrEqual(16);
  });
});
