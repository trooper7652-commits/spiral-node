import { describe, expect, it } from "vitest";
import { slugify, submitUrl } from "../../lib/submit";

describe("slugify", () => {
  it("lowercases and joins words with underscores", () => {
    expect(slugify("Fun Fact + Question")).toBe("fun_fact_question");
    expect(slugify("  --Hello, World!--  ")).toBe("hello_world");
  });
  it("falls back to my_script when nothing is left", () => {
    expect(slugify("")).toBe("my_script");
    expect(slugify("!!!")).toBe("my_script");
  });
  it("cuts to 40 characters and always matches the id pattern", () => {
    const s = slugify("a".repeat(60));
    expect(s).toHaveLength(40);
    for (const n of ["Connect", "x".repeat(39) + " y", "Tab\tNew\nLine", "Ünï"]) expect(slugify(n)).toMatch(/^[a-z0-9_]{1,40}$/);
  });
});

describe("submitUrl", () => {
  const repo = "https://github.com/o/r";
  it("encodes and caps at 7,500", () => {
    expect(submitUrl(repo, "my_script", 'a b\n"c"')).toBe(`${repo}/new/main?filename=scripts/my_script/script.py&value=${encodeURIComponent('a b\n"c"')}`);
    const base = submitUrl(repo, "x", "")!.length;
    expect(submitUrl(repo, "x", "a".repeat(7500 - base))).not.toBeNull();
    expect(submitUrl(repo, "x", "a".repeat(7501 - base))).toBeNull();
  });
});
