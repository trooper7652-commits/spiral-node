"use client";

import { useEffect, useRef, useState } from "react";
import { frameAt } from "../../lib/world/frame";
import { nightfallRise } from "../../lib/world/joins";
import { artScale, variantFor, viewSize } from "../../lib/world/pixel";
import { setStage } from "../../lib/world/stage";
import type { Frame, World } from "../../lib/world/types";
import { createPixel2d } from "./canvas2d";
import { createPixelRenderer } from "./pixelGl";
import { loadScene, type LoadedScene, type PixelRenderer, type ShotDraw } from "./sceneArt";
import { vhPx } from "./vh";

type Renderer = "webgl2" | "2d";
type Entry = { scene?: LoadedScene; failed?: boolean };

/** Reduced motion: every view rests on its shot's first key. */
function still(world: World, f: Frame): Frame {
  const view = (v: Frame["a"]) => ({ shot: v.shot, cam: { ...world.shots.find((x) => x.id === v.shot)!.keys[0].cam } });
  return { ...f, a: view(f.a), b: f.b && view(f.b) };
}

/** spacer={false}: only the canvas; the page's own sections give the scroll length. */
export default function WorldCanvas({ world, onFrame, spacer = true }: { world: World; onFrame?: (f: Frame) => void; spacer?: boolean }) {
  const [renderer, setRenderer] = useState<Renderer>("webgl2");
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;

  useEffect(() => {
    const el = canvas.current!;
    let pr: PixelRenderer;
    try {
      pr = renderer === "webgl2" ? createPixelRenderer(el) : createPixel2d(el);
    } catch (e) {
      if (renderer === "2d") throw e;
      setRenderer("2d");
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still_ = new URLSearchParams(location.search).has("still"); // test hook: ?still pins the sprite clock, scroll and joins work as usual
    const entries = new Map<string, Entry>();
    let ensured = "";
    let timeMs = 0; // the world's own clock: it stops while the loop does, so sprites carry on from where they were
    let last = 0;
    let raf = 0;
    let onScreen = true;
    let draws = 0;
    let lastKey = "";
    let gone = false;
    el.dataset.draws = "0";

    // Scroll px where each shot starts, to turn the scroll position into progress through a shot (for scrubbed sprites).
    const starts: number[] = [];
    let acc = 0;
    world.shots.forEach((s, i) => {
      starts.push(acc);
      acc += s.lengthVh + (world.joins[i]?.lengthVh ?? 0);
    });

    const running = () => !gone && onScreen && !document.hidden && document.visibilityState !== "hidden";

    function ensure(cur: number, variant: "wide" | "tall") {
      const key = cur + variant;
      if (key === ensured) return;
      ensured = key;
      const want = new Set<string>();
      for (const n of [cur, cur + 1, cur - 1]) {
        const url = world.shots[n]?.art?.[variant];
        if (url) want.add(url);
      }
      for (const [url, e] of entries) {
        if (want.has(url)) continue;
        entries.delete(url);
        if (e.scene) pr.free(e.scene);
      }
      for (const url of want) {
        if (entries.has(url)) continue;
        const e: Entry = {};
        entries.set(url, e);
        loadScene(url).then(
          (scene) => {
            if (entries.get(url) !== e || gone) return; // scrolled away or unmounted while loading
            e.scene = scene;
            poke();
          },
          (err) => {
            console.warn("world: scene failed to load", url, err);
            if (entries.get(url) !== e || gone) return;
            e.failed = true;
            poke();
          },
        );
      }
    }

    function fail(e: unknown) {
      console.warn("world: WebGL draw failed, using 2D", e);
      if (renderer === "webgl2") setRenderer("2d"); // shader or upload failure: never leave the screen blank
    }

    function draw() {
      if (gone || !wrap.current) return; // React clears refs at commit, before this effect's cleanup runs: a tick can land in between
      const dpr = devicePixelRatio || 1;
      const dev = { w: Math.ceil(innerWidth * dpr), h: Math.ceil(innerHeight * dpr) }; // up, so a fractional scale never leaves a line of page at the edge
      const variant = variantFor(dev);
      const scale = { w: innerWidth, h: vhPx() }; // scroll position meets the world data in vh, not in the toolbar-dependent innerHeight
      try {
        pr.resize(dev);
      } catch (e) {
        return fail(e);
      }
      let f = frameAt(world, scrollY, scale);
      if (reduced) f = still(world, f);
      const index = (id: string) => world.shots.findIndex((s) => s.id === id);
      ensure(index(f.a.shot), variant);
      // A scene still loading keeps the last picture (nothing is drawn) but the frame is still reported, so the text never lags the scroll; one that failed (or has no art) is simply not drawn.
      const state = (id: string): LoadedScene | null | "pending" => {
        const url = world.shots[index(id)].art?.[variant];
        const e = url ? entries.get(url) : undefined;
        return !url ? null : !e || (!e.scene && !e.failed) ? "pending" : (e.scene ?? null);
      };
      const sa = state(f.a.shot);
      const sb = f.b ? state(f.b.shot) : null;
      const a = sa === "pending" ? null : sa;
      const b = sb === "pending" ? null : sb;
      if ((a || b) && sa !== "pending" && sb !== "pending") {
        try {
          const px = scrollY * 100 / (scale.h || 1); // in vh
          const t = (id: string) => (reduced ? 0 : Math.min(1, Math.max(0, (px - starts[index(id)]) / world.shots[index(id)].lengthVh)));
          const time = reduced || still_ ? 0 : timeMs;
          const A = a && { scene: a, cam: f.a.cam, t: t(f.a.shot) };
          const B = b && { scene: b, cam: f.kind === "nightfall" && !reduced ? { ...f.b!.cam, y: f.b!.cam.y + nightfallRise(f.mix) } : f.b!.cam, t: t(f.b!.shot) };
          // Reduced motion, or a side that did not load: the join is a hard cut at mix 0.5.
          if (A && B && !reduced) pr.draw(time, A, { kind: f.kind!, mix: f.mix, params: world.joins[index(f.a.shot)].params, b: B });
          else pr.draw(time, (f.mix >= 0.5 ? B ?? A : A ?? B) as ShotDraw);
        } catch (e) {
          return fail(e);
        }
        el.dataset.draws = String(++draws);
        el.style.visibility = "visible"; // hidden until the first picture, so the page never shows black or a half-loaded canvas
        wrap.current!.dataset.time = String(Math.round(reduced ? 0 : timeMs));
      }

      // The data attributes name the frame on the canvas, so they wait for its scene; the text does not.
      const mix = Math.round(f.mix * 1000) / 1000;
      if (sa !== "pending" && sb !== "pending") {
        const d = wrap.current!.dataset;
        for (const [k, v] of [["shot", f.a.shot], ["kind", f.kind ?? ""], ["mix", String(mix)]]) if (d[k] !== v) d[k] = v;
      }
      // Tell the page where the art sits (tags pin to it): only a shot at rest in a hold, with its scene loaded.
      const k = artScale(dev);
      setStage(f.hold && !f.b && a ? { shot: f.a.shot, hold: f.hold, holdT: f.holdT ?? 0, art: a.art, cam: f.a.cam, view: viewSize(dev, k), k, dpr } : null);
      // Report a frame only when it differs from the last one: the loop draws every tick, the page re-renders on a change.
      const key = JSON.stringify([f.a.shot, f.kind, mix, f.hold, f.holdT]);
      if (key === lastKey) return;
      lastKey = key;
      frameCb.current?.(f);
    }

    function tick(now: number) {
      raf = 0;
      timeMs += Math.max(0, Math.min(100, now - last));
      last = now;
      draw();
      if (running()) raf = requestAnimationFrame(tick);
    }
    // Something changed (scroll, resize, a scene landing): the loop picks it up; with reduced motion there is no loop, so draw once.
    function poke() {
      if (raf || !running()) return;
      if (!reduced) last = performance.now();
      raf = requestAnimationFrame(reduced ? () => ((raf = 0), draw()) : tick);
    }

    const lost = (e: Event) => {
      e.preventDefault();
      setRenderer("2d");
    };
    const visibility = () => {
      if (!running()) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else poke();
    };
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((es) => {
      onScreen = es[es.length - 1].isIntersecting;
      visibility();
    });
    io?.observe(el);
    el.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    addEventListener("scroll", poke, { passive: true });
    // A resize or a font landing changes how the text sits, so the frame is reported again even if it is the same one.
    const again = () => {
      lastKey = "";
      poke();
    };
    addEventListener("resize", again);
    document.fonts?.addEventListener("loadingdone", again);
    document.fonts?.ready.then(again);
    poke();
    return () => {
      gone = true;
      setStage(null);
      cancelAnimationFrame(raf);
      io?.disconnect();
      el.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", visibility);
      removeEventListener("scroll", poke);
      removeEventListener("resize", again);
      document.fonts?.removeEventListener("loadingdone", again);
      for (const e of entries.values()) if (e.scene) pr.free(e.scene);
      pr.dispose();
    };
  }, [world, renderer]);

  // Spacer: max scrollY equals totalPx(world, innerHeight). Anchors let /#shot-id scroll natively, even before hydration.
  let start = 0;
  const anchors = world.shots.map((s, i) => {
    const top = start;
    start += s.lengthVh + (world.joins[i]?.lengthVh ?? 0);
    return <div key={s.id} id={s.id} style={{ position: "absolute", top: `${top}vh`, height: 0 }} />;
  });

  return (
    <div ref={wrap} data-renderer={renderer}>
      <canvas key={renderer} ref={canvas} data-world="" aria-hidden="true" style={{ position: "fixed", left: 0, top: 0, zIndex: -1, imageRendering: "pixelated", visibility: "hidden" }} />
      <div data-vh aria-hidden style={{ position: "fixed", top: 0, left: 0, width: 0, height: "100vh", visibility: "hidden", pointerEvents: "none" }} />
      {spacer && <div style={{ position: "relative", height: `calc(${start}vh + 100vh)` }}>{anchors}</div>}
    </div>
  );
}
