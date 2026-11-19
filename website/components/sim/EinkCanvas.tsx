"use client";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { H, W, toImageData, type RGB } from "@/lib/sim/bits";
import { GHOST_MS, refreshPlan } from "@/lib/sim/refresh";
import type { Frame } from "./useSimulator";

const PAPER: RGB = [0xf4, 0xec, 0xd8];
const INK: RGB = [0x1d, 0x1a, 0x16];
const css = (c: RGB) => `rgb(${c.join(",")})`;

type Props = { frame: Frame; realism: boolean; devicePx: number; cssWidth: number };

/** Paints 1-bit frames at an integer device-pixel scale, with optional e-ink flash and ghost. */
function EinkCanvas({ frame, realism, devicePx, cssWidth }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const prev = useRef<HTMLCanvasElement | null>(null);
  const cancel = useRef<() => void>(() => {});
  const lastFull = useRef(-Infinity);
  const flashes = useRef(0);
  const seen = useRef(0);
  const realismRef = useRef(realism);
  realismRef.current = realism;

  const mark = (busy: boolean) => {
    const c = ref.current;
    if (c) {
      c.dataset.busy = busy ? "1" : "0";
      c.dataset.flashes = String(flashes.current);
    }
  };

  // Repaint at the right size whenever the scale changes (resizing clears a canvas).
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = W * devicePx;
    c.height = H * devicePx;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    cancel.current();
    ctx.fillStyle = css(PAPER);
    ctx.fillRect(0, 0, c.width, c.height);
    if (small.current) ctx.drawImage(small.current, 0, 0, c.width, c.height);
    mark(false);
  }, [devicePx]);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const next = document.createElement("canvas");
    next.width = W;
    next.height = H;
    next.getContext("2d")!.putImageData(new ImageData(toImageData(frame.pixels, INK, PAPER) as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
    prev.current = small.current;
    small.current = next;
    seen.current = frame.seq;

    const draw = (alphaPrev = 0) => {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.drawImage(next, 0, 0, c.width, c.height);
      if (alphaPrev > 0 && prev.current) {
        ctx.globalAlpha = alphaPrev;
        ctx.drawImage(prev.current, 0, 0, c.width, c.height);
        ctx.globalAlpha = 1;
      }
    };
    const fill = (colour: RGB) => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(colour);
      ctx.fillRect(0, 0, c.width, c.height);
      flashes.current++;
    };

    cancel.current();
    const now = performance.now();
    const plan = refreshPlan(realismRef.current, frame.full, now - lastFull.current);
    if (plan.some((s) => s.fill !== "frame")) lastFull.current = now;

    let timer = 0;
    let raf = 0;
    cancel.current = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    mark(true);
    const run = (i: number) => {
      const s = plan[i];
      if (!s) return mark(false);
      if (s.fill === "ink") fill(INK);
      else if (s.fill === "paper") fill(PAPER);
      else if (s.ghost) {
        const t0 = performance.now();
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / GHOST_MS);
          draw(0.25 * (1 - p));
          if (p < 1) raf = requestAnimationFrame(step);
          else mark(false);
        };
        step();
        return;
      } else {
        draw();
        return mark(false);
      }
      mark(true);
      timer = window.setTimeout(() => run(i + 1), s.ms);
    };
    run(0);
    return () => cancel.current();
  }, [frame]);

  return (
    <canvas
      ref={ref}
      data-testid="screen"
      data-screen={frame.screen}
      data-full={frame.full ? "1" : "0"}
      data-frames={frame.seq}
      aria-hidden="true"
      style={{ width: cssWidth, height: (cssWidth * H) / W, imageRendering: "pixelated", display: "block" }}
    />
  );
}

// Wheel presses re-render the simulator; the canvas only repaints for a new frame.
export default memo(EinkCanvas);
