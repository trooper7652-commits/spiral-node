import { afterEach, describe, expect, it, vi } from "vitest";
import { readWelcome, welcomeBody, writeWelcome } from "../../lib/welcome";

describe("welcomeBody", () => {
  it("encodes email and present fields in order, trimming values", () => {
    const res = welcomeBody({
      email: " a@b.co ",
      firstName: " Alice ",
      occupation: "maker",
      broughtHere: "   ",
    });

    const keys = Array.from(res.keys());
    expect(keys).toEqual(["email_address", "fields[first_name]", "fields[occupation]"]);
    expect(res.get("email_address")).toBe("a@b.co");
    expect(res.get("fields[first_name]")).toBe("Alice");
    expect(res.get("fields[occupation]")).toBe("maker");
    expect(res.has("fields[brought_here]")).toBe(false);
  });

  it("leaves out empty or whitespace-only answers", () => {
    const res = welcomeBody({ email: "test@example.com", firstName: "", occupation: "   " });
    expect(Array.from(res.keys())).toEqual(["email_address"]);
  });
});

describe("welcome storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("blocked storage (it throws) never throws, and this page view remembers", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(() => writeWelcome("skipped")).not.toThrow();
    expect(readWelcome()).toBe("skipped");
  });
});
