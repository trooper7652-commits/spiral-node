import { describe, expect, it } from "vitest";
import { NAV } from "../../lib/nav";

describe("NAV", () => {
  it("has the seven links in order", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Product", "Scripts", "Today", "Community", "Devlog", "Build log", "\u2605 GitHub"]);
  });
  it("hooks are one short line", () => {
    for (const n of NAV) {
      expect(n.hook.length).toBeGreaterThan(0);
      expect(n.hook.length).toBeLessThanOrEqual(64);
      expect(n.hook).not.toContain("\n");
    }
  });
});
