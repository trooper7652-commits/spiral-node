"use client";

import { useEffect, useRef, useState } from "react";
import { BAND_ROWS, BANDS, bandCam, type BandScene } from "../lib/world/band";
import { createPixel2d } from "./world/canvas2d";
import { createPixelRenderer } from "./world/pixelGl";
import { loadScene, type PixelRenderer } from "./world/sceneArt";
import styles from "./PageBand.module.css";

const SPRITE_MS = 1000 / 12;

/**
 * A strip of a pixel scene across the top of a page: 180 art rows at the home world's scale, a fixed camera, sprites on the renderer's clock.
 * The loop runs only while the band is on screen and the tab is visible; reduced motion draws one still frame.
 */
export default function PageBand({ scene, rows = BAND_ROWS }: { scene: BandScene; rows?: number }) {
  const [renderer, setRenderer] = useState<"webgl2" | "2d">("webgl2");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A fresh canvas per effect run: a lost WebGL context cannot be reacquired, and strict mode runs the effect twice on one element.
    const el = document.createElement("canvas");
    el.className = styles.canvas;
    el.dataset.band = "";
    el.dataset.scene = scene;
    el.setAttribute("aria-hidden", "true");
    wrap.current!.append(el);
    // Gives the GPU context back now rather than when the garbage collector gets to it (a browser keeps about 16 alive).
    const release = () => {
      const gl = el.getContext("webgl2") as WebGL2RenderingContext | null; // the one it already has, or null on a 2D canvas
      if (gl && !gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
      el.remove();
    };
    let pr: PixelRenderer;
    try {
      pr = renderer === "webgl2" ? createPixelRenderer(el) : createPixel2d(el);
    } catch (e) {
      release();
      if (renderer === "2d") throw e;
      setRenderer("2d");
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let loaded: Awaited<ReturnType<typeof loadScene>> | null = null;
    let timeMs = 0; // the band's own clock: it stops while the loop does, so sprites carry on from where they were
    let last = 0;
    let raf = 0;
    let onScreen = true;
    let draws = 0;
    let lastSig = -1;
    let gone = false;
    el.dataset.draws = "0";

    const running = () => !gone && onScreen && !document.hidden && document.visibilityState !== "hidden";

    function draw() {
      if (gone || !loaded || !wrap.current) return;
      const dpr = devicePixelRatio || 1;
      try {
        pr.resize({ w: Math.ceil(innerWidth * dpr), h: Math.ceil(innerHeight * dpr) }, rows);
        pr.draw(reduced ? 0 : timeMs, { scene: loaded, cam: bandCam(scene, rows), t: 0 });
      } catch (e) {
        console.warn("band: draw failed", e);
        if (renderer === "webgl2") setRenderer("2d");
        return;
      }
      wrap.current.style.height = el.style.height; // the space the page reserved is now exact
      el.dataset.draws = String(++draws);
      el.style.visibility = "visible"; // hidden until the first picture: the paper ground shows until then
    }
    function tick(now: number) {
      raf = 0;
      timeMs += Math.max(0, Math.min(100, now - last));
      last = now;
      const sig = Math.floor(timeMs / SPRITE_MS); // sprites run at 12 fps or less: draw when a frame can have changed, not every refresh
      if (sig !== lastSig) {
        lastSig = sig;
        draw();
      }
      if (running()) raf = requestAnimationFrame(tick);
    }
    // Something changed (a resize, the scene landing, back on screen): the loop picks it up; with reduced motion there is no loop, so draw once.
    function poke() {
      if (raf || !running()) return;
      if (!reduced) last = performance.now();
      raf = requestAnimationFrame(reduced ? () => ((raf = 0), draw()) : tick);
    }
    const visibility = () => {
      if (!running()) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else poke();
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setRenderer("2d");
    };
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((es) => {
      onScreen = es[es.length - 1].isIntersecting;
      visibility();
    });
    io?.observe(el);
    el.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    const resized = () => {
      lastSig = -1;
      poke();
    };
    addEventListener("resize", resized);
    loadScene(BANDS[scene].url).then(
      (s) => {
        if (gone) return;
        loaded = s;
        poke();
      },
      (err) => console.warn("band: scene failed to load", err),
    );
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
      el.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", visibility);
      removeEventListener("resize", resized);
      if (loaded) pr.free(loaded);
      pr.dispose();
      release();
    };
  }, [scene, renderer, rows]);

  // a short band reserves its own space (3 device px per row, a laptop) until the first draw sets the exact height
  const reserve = rows === BAND_ROWS ? undefined : { height: rows * 3 };
  return <div ref={wrap} className={styles.band} style={reserve} data-band-renderer={renderer} />;
}
