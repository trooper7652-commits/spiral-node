import { existsSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test("/scripts lists every script, each linking to the simulator", async ({ page }) => {
  await page.goto("/scripts");
  await expect(page.getByTestId("script-card")).toHaveCount(12);
  for (const id of ["big_questions", "chess_puzzles", "choose_your_path", "connect", "daily_puzzle", "famous_quotes", "fun_fact_question", "on_this_day", "poems", "quick_story", "space_facts", "streak_quiz"]) await expect(page.locator(`a[href="/try?script=${id}"]`)).toHaveCount(1);
});

test("/scripts/chess_puzzles shows name, description, author, Run in simulator, Copy link, and og:image = /og/script-chess_puzzles.png", async ({ page }) => {
  await page.goto("/scripts/chess_puzzles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chess Puzzles");
  await expect(page.locator("main")).toContainText("by ");
  await expect(page.getByRole("link", { name: "Run in simulator" })).toHaveAttribute("href", "/try?script=chess_puzzles");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect(page.locator("main p").first()).not.toBeEmpty();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/script-chess_puzzles\.png$/);
});

test("GET /feed.xml returns RSS with 30 items", async ({ page }) => {
  await page.goto("/");
  const { type, xml } = await page.evaluate(async () => {
    const r = await fetch("/feed.xml");
    return { type: r.headers.get("content-type") ?? "", xml: await r.text() };
  });
  expect(type).toContain("xml");
  const doc = await page.evaluate((x) => {
    const d = new DOMParser().parseFromString(x, "application/xml");
    return { errors: d.getElementsByTagName("parsererror").length, items: d.getElementsByTagName("item").length };
  }, xml);
  expect(doc).toEqual({ errors: 0, items: 30 });
});

test("unknown id → 404 page", async ({ page }) => {
  // the static export has no page for an unknown id and Next's 404 page ships as out/404.html;
  // the preview server answers unknown paths with a fallback page instead of a 404 status, so check the files and the 404 page itself
  expect(existsSync("out/scripts/does_not_exist.html")).toBe(false);
  expect(existsSync("out/scripts/chess_puzzles.html")).toBe(true);
  await page.goto("/404.html");
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("/devlog lists the first entry, and it opens", async ({ page }) => {
  await page.goto("/devlog");
  await page.getByRole("link", { name: "Spiral Node is open source" }).click();
  await expect(page).toHaveURL(/\/devlog\/2026-11-16-open-source$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spiral Node is open source");
});

test("/press has the logo download, and the file is there", async ({ page, request }) => {
  await page.goto("/press");
  await expect(page.getByRole("link", { name: /Spiral logo/ })).toHaveAttribute("href", "/press/spiral-node-logo.png");
  expect((await request.get("/press/spiral-node-logo.png")).status()).toBe(200);
});

test("contest page shows rules, the current theme, and a link to /write", async ({ page }) => {
  await page.goto("/contest");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Script of the Month");
  await expect(page.locator("main")).toContainText("Questions worth sitting with");
  await expect(page.locator("main")).toContainText("No purchase needed");
  await expect(page.locator('main a[href="/write"]')).toHaveCount(1);
});

test("founder page renders", async ({ page }) => {
  await page.goto("/founder");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Why I started Spiral Node");
  await expect(page.locator("main")).toContainText("connect ideas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test('build log shows "First photos coming soon" with no entries', async ({ page }) => {
  await page.goto("/build-log");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build log");
  await expect(page.locator("main")).toContainText("First photos coming soon.");
});

test("changelog lists v0.1.0", async ({ page }) => {
  await page.goto("/changelog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  await expect(page.getByRole("heading", { name: "v0.1.0 (2026-11-21)" })).toBeVisible();
  await expect(page.locator("main")).toContainText("open hardware notes");
});

test("home links to the script gallery and the latest devlog entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('main a[href="/scripts"]')).toHaveCount(2); // "See more scripts" in scene 5 and the Scripts path in scene 9
  await expect(page.locator('main a[href="/devlog/2026-11-16-open-source"]')).toHaveCount(1);
});

for (const path of ["/", "/try", "/scripts", "/devlog", "/devlog/2026-11-16-open-source", "/press", "/company"]) {
  test(`link preview image on ${path}`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/spiral-node-helix-velocities\.vercel\.app\/og\/[a-z]+\.png"/);
  });
}

test("press page has a demo video with a poster and controls", async ({ page }) => {
  await page.goto("/press");
  const v = page.locator("video");
  await expect(v).toHaveAttribute("poster", "/press/demo-poster.png");
  await expect(v).toHaveAttribute("controls", "");
  await expect(v).toHaveJSProperty("muted", true);
  await expect(v.locator('source[type="video/webm"]')).toHaveAttribute("src", "/press/demo.webm");
  await expect(page.getByRole("link", { name: /Download the video/ })).toHaveAttribute("href", "/press/demo.webm");
  const btn = page.getByRole("button", { name: "Pause video" });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(v).toHaveJSProperty("paused", true);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("demo video starts paused", async ({ page }) => {
    await page.goto("/press");
    await expect(page.getByRole("button", { name: "Pause video" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });
});

test("design page shows the sketch sheet with alt text naming all five shapes; no poll button while designPollUrl is empty", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Design explorations");
  await expect(page.locator("main")).toContainText("Prototype design, may change. Which shape would you carry?");
  const img = page.locator('main img[src="/design/form-factors.svg"]');
  await expect(img).toBeVisible();
  for (const name of ["Harmonica bar", "Snail-shell puck", "Pocket book", "Locket", "Standing stone"]) {
    await expect(img).toHaveAttribute("alt", new RegExp(name));
  }
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Vote in the poll" })).toHaveCount(0);
});

test("/today with a fixed clock shows that date's On This Day events, one fact with its source link, and one question", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 6, 4, 10, 0));
  await page.goto("/today");
  const events = JSON.parse(readFileSync("../os/spiral/builtin_scripts/on_this_day/events.json", "utf8")).filter((e: { topic: string }) => e.topic === "07-04");
  await expect(page.locator("[data-testid=today-events] li")).toHaveCount(events.length);
  await expect(page.locator("[data-testid=today-events] li").first()).toContainText(events[0].text);
  await expect(page.locator("[data-testid=today-fact] a")).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator("[data-testid=today-question]")).not.toBeEmpty();
  await expect(page.locator("main")).toContainText("July 4, 2026");
  await expect(page.getByTestId("today-credit")).toContainText("CC BY-SA 4.0");
});

test("/follow lists the always-here links, no channel cards, no footer link, no sideways scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/follow");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visit us");
  const main = page.locator("main");
  await expect(main.locator('a[href="https://github.com/trooper7652-commits/spiral-node"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://github.com/trooper7652-commits/spiral-node/discussions"]')).toHaveCount(1);
  await expect(main.locator('a[href="/press"]')).toHaveCount(1);
  await expect(page.getByTestId("channel-card")).toHaveCount(0);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Visit us" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("/credits renders and the footer links to it", async ({ page }) => {
  await page.goto("/credits");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Credits");
  await expect(page.locator("main")).toContainText("VT323");
  await expect(page.locator("main")).toContainText("SIL Open Font License");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Credits" })).toHaveAttribute("href", "/credits");
});

test("the product page draws the device in ink, with no pixel drawing", async ({ page }) => {
  await page.goto("/spiral-node");
  await expect(page.getByRole("img", { name: "Spiral Node, a drawing of the planned pager" })).toBeVisible();
  await expect(page.locator('main img[src^="/art/device"]')).toHaveCount(0);
});

// The page band and the paper shell, proved on /credits.
test.describe("page band and shell", () => {
  const band = (page: Page) => page.locator("canvas[data-band]");
  const draws = async (page: Page) => Number(await band(page).getAttribute("data-draws"));
  const drawn = async (page: Page) => {
    await expect(band(page)).toBeAttached();
    await expect.poll(() => draws(page)).toBeGreaterThan(0);
  };
  const hash = (page: Page) =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-band]")!;
      const s = document.createElement("canvas");
      s.width = c.width;
      s.height = c.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      let h = 2166136261;
      for (const v of ctx.getImageData(0, 0, s.width, s.height).data) h = Math.imul(h ^ v, 16777619);
      return h >>> 0;
    });

  test.beforeEach(async ({ page }) => {
    await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    // the home page asks GitHub for the star count: never let a test reach it
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"stargazers_count":3}' }));
  });

  for (const deviceScaleFactor of [1, 1.25, 1.5])
  test.describe(`at device scale ${deviceScaleFactor}`, () => {
  test.use({ deviceScaleFactor });
  test("the band is a crisp canvas of 180 art rows at a whole-number scale", async ({ page }) => {
    await page.goto("/credits");
    await drawn(page);
    await expect(band(page)).toHaveAttribute("data-scene", "countryside");
    await expect(band(page)).toHaveAttribute("aria-hidden", "true");
    const info = await page.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-band]")!;
      const palette: string[] = await fetch("/world/palette.json").then((r) => r.json());
      const s = document.createElement("canvas");
      s.width = c.width;
      s.height = c.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, s.width, s.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      const colours = [...seen].map((v) => `rgb(${v >> 16}, ${(v >> 8) & 255}, ${v & 255})`);
      const r = c.getBoundingClientRect();
      return { off: colours.filter((x) => !palette.includes(x)), n: colours.length, rows: c.height, kw: (r.width * devicePixelRatio) / c.width, kh: (r.height * devicePixelRatio) / c.height, left: r.left, devW: r.width * devicePixelRatio, cw: c.width };
    });
    expect(info.off).toEqual([]); // palette colours only
    expect(info.n).toBeGreaterThan(1);
    expect(info.rows).toBe(180);
    expect(Number.isInteger(Math.round(info.kw * 1000) / 1000)).toBe(true);
    expect(info.kh).toBeCloseTo(info.kw, 3);
    expect(info.left).toBe(0);
    expect(Math.abs(info.devW - info.cw * info.kw)).toBeLessThan(1);
  });
  });

  test("visiting banded pages by client-side links leaks no WebGL context and the band still draws", async ({ page }) => {
    const bad: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || /Too many active WebGL contexts/.test(m.text())) bad.push(m.text());
    });
    page.on("pageerror", (e) => bad.push(String(e)));
    await page.goto("/credits");
    await drawn(page);
    // alternate with the home page (no band) through the router
    for (let i = 0; i < 20; i++) {
      await page.evaluate((to) => (window as any).next.router.push(to), i % 2 === 0 ? "/" : "/credits");
      if (i % 2 === 1) await drawn(page);
      else await expect(band(page)).toHaveCount(0);
    }
    await page.evaluate(() => (window as any).next.router.push("/credits"));
    await drawn(page);
    expect(bad).toEqual([]);
  });

  test("the band animates while idle", async ({ page }) => {
    await page.goto("/credits");
    await drawn(page);
    const a = await hash(page);
    await page.waitForTimeout(1000);
    expect(await hash(page)).not.toBe(a);
  });

  test("the band stops drawing when scrolled out of view and carries on when back", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 300 });
    await page.goto("/credits");
    await drawn(page);
    await page.evaluate(() => {
      const pad = document.createElement("div");
      pad.style.height = "4000px";
      document.querySelector("main")!.append(pad);
      scrollTo({ top: 3000, behavior: "instant" });
    });
    await page.waitForTimeout(300); // the observer fires, a frame in flight lands
    const stopped = await draws(page);
    await page.waitForTimeout(500);
    expect(await draws(page)).toBe(stopped);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => draws(page)).toBeGreaterThan(stopped);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("the band is one still frame", async ({ page }) => {
      await page.goto("/credits");
      await drawn(page);
      const a = await hash(page);
      await page.waitForTimeout(1000);
      expect(await hash(page)).toBe(a);
    });
  });

  test("the h1 and every section heading sit inside a panel", async ({ page }) => {
    // /spiral-node's own hero (its h1) has its own style; its Section headings are the ones the shell covers
    for (const [path, heads] of [["/credits", "main h1, main h2"], ["/spiral-node", "main h2"]]) {
      await page.goto(path);
      const loose = await page.locator(heads).evaluateAll((hs) => hs.filter((h) => !h.closest("[data-panel]")).map((h) => h.textContent));
      expect(loose, path).toEqual([]);
    }
    await page.goto("/credits");
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("[data-panel] h1")).toHaveCount(1);
  });

  test("without JavaScript the page text is all there", async ({ page, baseURL }) => {
    const text = async (p: Page) => (await p.locator("main").innerText()).replace(/\s+/g, " ").trim();
    await page.goto("/credits");
    const withJs = await text(page);
    const ctx = await page.context().browser()!.newContext({ baseURL, javaScriptEnabled: false });
    const bare = await ctx.newPage();
    await bare.goto("/credits");
    expect(await text(bare)).toBe(withJs);
    expect(withJs).toContain("Every picture on this site is drawn for it");
    await ctx.close();
  });
});

// The pixel look on all 17 routes, one loop.
const ROUTES: [string, string][] = [
  ["/spiral-node", "device"], ["/design", "device"], ["/try", "device"],
  ["/scripts", "scroll"], ["/scripts/chess_puzzles", "scroll"], ["/write", "scroll"],
  ["/today", "desk"],
  ["/devlog", "map"], ["/devlog/2026-11-16-open-source", "map"], ["/build-log", "map"], ["/changelog", "map"],
  ["/company", "countryside"], ["/founder", "countryside"], ["/press", "countryside"], ["/credits", "countryside"],
  ["/contest", "square"], ["/follow", "square"],
];

test.describe("every route has the band, one font, palette colours and fits a phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://app.kit.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"stargazers_count":3}' }));
  });

  test("there are 17 routes", () => expect(ROUTES).toHaveLength(17));

  for (const [path, scene] of ROUTES) {
    test(`${path}: ${scene} band, VT323, no navy, cyan or pink, no serious axe finding`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("canvas[data-band]")).toHaveAttribute("data-scene", scene);
      await expect(page.locator("main h1")).toHaveCount(1);

      // next/font renames the family: body, h1 and a link must all resolve to the one body family, and its fallbacks name VT323
      const fonts = await page.evaluate(() => {
        const f = (e: Element | null) => (e ? getComputedStyle(e).fontFamily : "");
        return { body: f(document.body), h1: f(document.querySelector("main h1")), link: f(document.querySelector("main a, header a")) };
      });
      expect(fonts.body).toMatch(/VT323/);
      // the families up to VT323 decide what is drawn; the generic fallbacks after it may differ (a link's stack ends in monospace)
      const lead = (s: string) => s.slice(0, s.indexOf("VT323"));
      expect(fonts.h1).toMatch(/VT323/);
      expect(fonts.link).toMatch(/VT323/);
      expect(lead(fonts.h1)).toBe(lead(fonts.body));
      expect(lead(fonts.link)).toBe(lead(fonts.body));

      const off = await page.evaluate(() => {
        // [r, g, b, a] from rgb(), rgba() or color(srgb ...); anything else is ignored
        const parse = (c: string): number[] | null => {
          const m = c.match(/^rgba?\(([^)]+)\)$/);
          if (m) {
            const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
            return [r, g, b, a];
          }
          const s = c.match(/^color\(srgb ([^)]+)\)$/);
          if (s) {
            const [r, g, b, a = 1] = s[1].split(/[\s/]+/).filter(Boolean).map(Number);
            return [r * 255, g * 255, b * 255, a];
          }
          return null;
        };
        // the three named classes are the floor (navy: dark blue at any saturation); beyond that no saturated blue, purple, pink or cyan at any lightness
        const bad = (c: string) => {
          const p = parse(c);
          if (!p || p[3] === 0) return null;
          const [r, g, b] = p.map((v) => v / 255);
          const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
          const l = (max + min) / 2;
          if (d === 0) return null; // fully desaturated
          const s = d / (1 - Math.abs(2 * l - 1));
          const h = ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
          if (h >= 200 && h <= 250 && l < 0.4) return "navy";
          if (s > 0.3 && h >= 170 && h < 200) return "cyan";
          if (s > 0.3 && h >= 200 && h <= 250) return "blue";
          if (s > 0.3 && h > 250 && h < 300) return "purple";
          if (s > 0.3 && h >= 300 && h <= 355) return "pink";
          return null;
        };
        // the sim's screen and device drawing are device art, not interface
        const art = (el: Element) => !!el.closest('canvas, img, svg, video, [data-band], [class*="screenInner"]');
        const out: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          if (art(el) || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
          const cs = getComputedStyle(el);
          for (const prop of ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"] as const) {
            const kind = bad(cs[prop]);
            if (kind) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} "${(el.textContent ?? "").trim().slice(0, 24)}": ${prop} ${cs[prop]} is ${kind}`);
          }
        }
        return out;
      });
      expect(off).toEqual([]);

      // every visible text is 20 px or more (text at 0 px is the sim's invisible key labels over the drawing)
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest('canvas, svg, [data-band], [class*="screenInner"]') || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
          if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) continue;
          const px = parseFloat(getComputedStyle(el).fontSize);
          if (px > 0 && px < 20) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}": ${px}px`);
        }
        return out;
      });
      expect(small).toEqual([]);

      await expect(page.locator("[data-panel] h1")).toHaveCount(1);

      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });

    test(`${path}: no sideways scroll at 360 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(path);
      await expect(page.locator("canvas[data-band]")).toBeAttached();
      // the full simulator laid out: power it on where there is one
      if (path === "/try" || path === "/write") await page.getByRole("button", { name: "Power on" }).first().click();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const fit = await page.evaluate(() => {
        const w = window.innerWidth;
        const wide = [...document.querySelectorAll("[data-panel], [data-panel] *")]
          .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 1 && Math.round(e.getBoundingClientRect().right) > w)
          .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`);
        return { page: document.documentElement.scrollWidth <= w, wide };
      });
      expect(fit.page).toBe(true);
      expect(fit.wide).toEqual([]); // clip-path hides what a panel overflows, so look at the boxes
    });
  }

  test("/spiral-node: the band is the short 60-row one and the launch list is on the first screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/spiral-node");
    await expect.poll(() => page.locator("canvas[data-band]").evaluate((c: HTMLCanvasElement) => c.height)).toBe(60);
    await expect(page.locator("#hero-cta").getByRole("link", { name: "Join the launch list" })).toBeInViewport({ ratio: 1 });
  });
});
