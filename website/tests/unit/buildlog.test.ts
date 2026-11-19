import { describe, expect, it } from "vitest";
import { listEntries, parse } from "../../lib/buildlog";

describe("build log", () => {
  it("parses front matter, the photo list and the Markdown body", () => {
    const e = parse("---\ndate: 2026-12-01\ntitle: First rig\nphotos: a.jpg, b.jpg\n---\nA **board** on the bench.");
    expect(e).toEqual({
      date: "2026-12-01",
      title: "First rig",
      photos: ["a.jpg", "b.jpg"],
      html: "<p>A <strong>board</strong> on the bench.</p>",
    });
  });
  it("allows no photos", () => {
    expect(parse("---\ndate: 2026-12-01\ntitle: Notes\n---\nText").photos).toEqual([]);
  });
  it("needs front matter with a title and date", () => {
    expect(() => parse("no front matter")).toThrow();
    expect(() => parse("---\ndate: 2026-12-01\n---\nbody")).toThrow(/title/);
  });
  it("has no entries yet", () => expect(listEntries()).toEqual([]));
});
