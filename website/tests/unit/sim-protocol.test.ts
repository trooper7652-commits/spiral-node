import { describe, expect, it } from "vitest";
import { scriptParam, type ToWorker } from "../../lib/sim/protocol";

describe("start a script from the URL", () => {
  it("reads a plain script id", () => {
    expect(scriptParam("?script=connect")).toBe("connect");
    expect(scriptParam("?a=1&script=fun_fact_question")).toBe("fun_fact_question");
  });

  it("ignores a missing, empty or odd id", () => {
    expect(scriptParam("")).toBeNull();
    expect(scriptParam("?script=")).toBeNull();
    expect(scriptParam("?script=../etc")).toBeNull();
    expect(scriptParam(`?script=${"a".repeat(65)}`)).toBeNull();
  });

  it("start message shape", () => {
    const m: ToWorker = { v: 1, type: "start", script: "connect", t: 0 };
    expect(Object.keys(m).sort()).toEqual(["script", "t", "type", "v"]);
  });
});
