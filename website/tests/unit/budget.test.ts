import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("home page image budget", () => {
  it("the first screen, each scene and the whole story are within budget", () => {
    // throws (and fails the test) when the script exits 1
    const out = execFileSync(process.execPath, ["--no-warnings", "scripts/check-budget.mjs"], { encoding: "utf8" });
    expect(out).toMatch(/^ok +first:/m);
    expect(out).toMatch(/^ok +shot:/m);
    expect(out).toMatch(/^ok +story:/m);
    expect(out).toMatch(/^scene +\S+: wide \d+ KB, tall \d+ KB$/m);
  });
});
