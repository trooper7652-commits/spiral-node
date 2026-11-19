import { afterEach, describe, expect, it, vi } from "vitest";
import { DAY_MS, readState, shouldShow, writeState } from "../../lib/popup";

const base = { now: 100 * DAY_MS, visibleMs: 60_000, path: "/", demoRunning: false, forced: false, formUrl: "https://example.com/form" };

describe("shouldShow", () => {
  it("shows after 60 s of visible-tab time", () => expect(shouldShow(base)).toBe(true));
  it("boundary: 59 999 ms no, 60 000 ms yes", () => {
    expect(shouldShow({ ...base, visibleMs: 59_999 })).toBe(false);
    expect(shouldShow({ ...base, visibleMs: 60_000 })).toBe(true);
  });
  it("forced shows at once, even with no form URL", () => expect(shouldShow({ ...base, visibleMs: 0, formUrl: "", forced: true })).toBe(true));
  it("an empty form URL never shows", () => expect(shouldShow({ ...base, formUrl: "" })).toBe(false));
  it("subscribed never shows", () => expect(shouldShow({ ...base, subscribed: true })).toBe(false));
  it("never on /try, even forced", () => {
    expect(shouldShow({ ...base, path: "/try" })).toBe(false);
    expect(shouldShow({ ...base, path: "/try", forced: true })).toBe(false);
  });
  it("never while the hero demo runs, even forced", () => {
    expect(shouldShow({ ...base, demoRunning: true })).toBe(false);
    expect(shouldShow({ ...base, demoRunning: true, forced: true })).toBe(false);
  });
  it("dismissed under 30 days ago stays away; from 30 days it may show again", () => {
    expect(shouldShow({ ...base, dismissedAt: base.now - 29 * DAY_MS })).toBe(false);
    expect(shouldShow({ ...base, dismissedAt: base.now - 30 * DAY_MS })).toBe(true);
  });
});

describe("popup storage", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("blocked storage (it throws) never throws, and this page view remembers", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(() => writeState({ dismissedAt: 5 })).not.toThrow();
    expect(readState().dismissedAt).toBe(5);
  });
  it("round-trips through localStorage and keeps earlier fields", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    writeState({ subscribed: true });
    writeState({ dismissedAt: 7 });
    expect(readState()).toEqual({ subscribed: true, dismissedAt: 7 });
  });
});
