import { describe, expect, it } from "vitest";
import { listPosts, markdown, parse } from "../../lib/devlog";

describe("devlog", () => {
  it("lists the first entry", () => {
    const [p] = listPosts();
    expect(p.slug).toBe("2026-11-16-open-source");
    expect(p.title).toBe("Spiral Node is open source");
    expect(p.date).toBe("2026-11-16");
    expect(p.html).toContain("<h2>Connect</h2>");
  });
  it("renders headings, lists, bold and links, and escapes HTML", () => {
    expect(markdown("## Hi\n\n- **a**\n- [b](/try)\n\nx <script> y")).toBe(
      '<h2>Hi</h2>\n<ul><li><strong>a</strong></li><li><a href="/try">b</a></li></ul>\n<p>x &lt;script&gt; y</p>',
    );
  });
  it("never links javascript: URLs", () => expect(markdown("[x](javascript:alert(1))")).not.toContain("<a"));
  it("never links protocol-relative //host URLs", () => expect(markdown("[x](//example.com/a)")).not.toContain("<a"));
  it("needs front matter with a title, date and summary", () => {
    expect(() => parse("x", "no front matter")).toThrow();
    expect(() => parse("x", "---\ntitle: T\ndate: 2026-01-01\n---\nbody")).toThrow(/summary/);
  });
});
