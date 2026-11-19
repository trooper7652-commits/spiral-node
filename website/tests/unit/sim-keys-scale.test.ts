import { describe, expect, it } from "vitest";
import { keyToButton } from "../../lib/sim/keys";
import { screenScale } from "../../lib/sim/scale";
import type { FromWorker, ToWorker } from "../../lib/sim/protocol";
import { PROTOCOL_VERSION } from "../../lib/sim/protocol";

describe("keyToButton", () => {
  it("maps keys", () => {
    expect(keyToButton("ArrowUp")).toBe("up");
    expect(keyToButton("ArrowDown")).toBe("down");
    expect(keyToButton("ArrowLeft")).toBe("left");
    expect(keyToButton("ArrowRight")).toBe("right");
    expect(keyToButton("Enter")).toBe("select");
    expect(keyToButton(" ")).toBe("select");
    expect(keyToButton("Escape")).toBe("back");
    expect(keyToButton("Backspace")).toBe("back");
    expect(keyToButton("h")).toBe("home");
    expect(keyToButton("H")).toBe("home");
    expect(keyToButton("a")).toBeNull();
  });
});

describe("screenScale", () => {
  it("picks integer device pixels", () => {
    expect(screenScale(600, 2)).toEqual({ devicePx: 4, cssWidth: 500 });
    const s = screenScale(360, 3);
    expect(s.devicePx).toBe(4);
    expect(s.cssWidth).toBeCloseTo(333.33, 2);
    expect(screenScale(100, 1).devicePx).toBe(1);
    expect(screenScale(10, 1).devicePx).toBe(1);
  });
});

describe("protocol", () => {
  it("compiles every message", () => {
    const to: ToWorker[] = [
      { v: 1, type: "init" },
      { v: 1, type: "power", t: 0 },
      { v: 1, type: "input", kind: "press", button: "up", t: 0 },
      { v: 1, type: "input", kind: "press", button: "home", t: 0 },
      { v: 1, type: "input", kind: "release", button: "back", t: 0 },
      { v: 1, type: "back", t: 0 },
      { v: 1, type: "reset" },
    ];
    const from: FromWorker[] = [
      { v: 1, type: "progress", stage: "boot", pct: 1 },
      { v: 1, type: "frame", bits: new ArrayBuffer(3904), full: true, screen: "home", text: "", saving: false, poweredOff: false },
      { v: 1, type: "error", kind: "python", message: "x" },
    ];
    expect(to.length + from.length).toBe(10);
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
