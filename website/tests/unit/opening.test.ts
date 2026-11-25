import { describe, expect, it } from "vitest";
import { markOpened, OPENED_KEY, rememberedScroll, rememberedWorld, rememberScroll, rememberWorld, shouldOpen, wasOpened } from "../../lib/opening";

describe("shouldOpen(mode, seen, startsAtTop, reducedMotion)", () => {
  it("off is never", () => {
    for (const seen of [false, true]) expect(shouldOpen("off", seen, true, false)).toBe(false);
  });
  it("reduced motion is never", () => {
    for (const mode of ["first", "always"] as const) expect(shouldOpen(mode, false, true, true)).toBe(false);
  });
  it("not at the top is never (a link to a section, a restored scroll)", () => {
    for (const mode of ["first", "always"] as const) for (const seen of [false, true]) expect(shouldOpen(mode, seen, false, false)).toBe(false);
  });
  it("first plays until it has been seen", () => {
    expect(shouldOpen("first", true, true, false)).toBe(false);
    expect(shouldOpen("first", false, true, false)).toBe(true);
  });
  it("always plays every visit", () => {
    for (const seen of [false, true]) expect(shouldOpen("always", seen, true, false)).toBe(true);
  });
});

describe("the sn-opened key", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const blocked = {
    getItem: () => { throw new DOMException("blocked", "SecurityError"); },
    setItem: () => { throw new DOMException("blocked", "SecurityError"); },
  };

  it("is named sn-opened and starts unseen", () => {
    expect(OPENED_KEY).toBe("sn-opened");
    expect(wasOpened(memory())).toBe(false);
  });
  it("is seen once marked", () => {
    const s = memory();
    markOpened(s);
    expect(wasOpened(s)).toBe(true);
  });
  it("blocked storage is not seen and never throws", () => {
    expect(wasOpened(blocked)).toBe(false);
    expect(() => markOpened(blocked)).not.toThrow();
  });
  it("remembers the scroll in px; none, junk or blocked storage gives null", () => {
    const s = memory();
    expect(rememberedScroll(s)).toBeNull();
    rememberScroll(2468.6, s);
    expect(rememberedScroll(s)).toBe(2469);
    rememberScroll(-5, s);
    expect(rememberedScroll(s)).toBe(0);
    s.setItem("sn-opening-scroll", "abc");
    expect(rememberedScroll(s)).toBeNull();
    expect(rememberedScroll(blocked)).toBeNull();
    expect(() => rememberScroll(1, blocked)).not.toThrow();
  });
  it("remembers the tab's world for a reload; none stored or blocked storage gives null", () => {
    const s = memory();
    expect(rememberedWorld(s)).toBeNull();
    rememberWorld(true, s);
    expect(rememberedWorld(s)).toBe(true);
    rememberWorld(false, s);
    expect(rememberedWorld(s)).toBe(false);
    expect(rememberedWorld(blocked)).toBeNull();
    expect(() => rememberWorld(true, blocked)).not.toThrow();
  });
});
