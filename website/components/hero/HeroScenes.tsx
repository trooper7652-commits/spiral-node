"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { initialScene, nextWait, other, type Scene } from "@/lib/scenes";
import art from "../../public/art/scene.json";
import styles from "./HeroScenes.module.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

const ALT: Record<Scene, string> = {
  night: "A pixel-art apple tree on a hill at night, a small thinker lying on the grass beside a sleeping dog and looking up at the moon over a forest where a deer, a fox, an owl, bats and fireflies keep watch.",
  sunset: "A pixel-art apple tree on a hill at sunset, a small thinker sitting beneath it with a dog, looking over a forest where deer graze, butterflies drift by and frogs, a rabbit, a squirrel and birds go about their evening.",
};

type Animal = {
  testId: string; file: string; x: number; y: number; w: number; h: number; frames: number;
  kind: "idle" | "flyer" | "blink" | "still";
  dur?: number; delay?: number; hold?: number; bob?: number; flap?: number; walk?: number; drift?: number; driftDur?: number;
};
type Css = React.CSSProperties & Record<`--${string}`, number | string>;

/** One cast member. A strip of frames sits in a clipping box; CSS steps the strip (idle, blink, wing flap) and moves the box (flyers, fox, fireflies). */
function CastMember({ a }: { a: Animal }) {
  const { testId, file, x, y, w, h, frames, kind } = a;
  const sheet = (cls: string, style: Css = {}) => (
    <div className={styles.clip} style={{ width: px(w), height: px(h) }}>
      <img aria-hidden="true" alt="" src={`/art/${file}`} className={`pixelated ${styles.strip} ${cls}`} style={{ width: px(w * frames), height: px(h), ...style }} />
    </div>
  );
  const at: Css = { left: px(x), top: px(y), width: px(w), height: px(h) };
  if (kind === "flyer") {
    const style: Css = { ...at, "--x0": -(x + w), "--x1": 320 - x, animationDuration: `${(a.dur ?? 24) * 2}s`, animationDelay: `${a.delay ?? 0}s` };
    return (
      <div data-testid={testId} className={`${styles.fly} ${styles.anim}`} style={style}>
        <div className={`${styles.bob} ${styles.anim}`} style={{ "--bob": a.bob ?? 6 } as Css}>
          {sheet(`${styles.flap} ${styles.anim}`, { animationDuration: `${a.flap ?? 0.25}s` })}
        </div>
      </div>
    );
  }
  if (kind === "blink" && frames === 1) {
    const outer: Css = { ...at, "--dx": a.drift ?? 4, "--dy": -(a.drift ?? 4) * 0.7, animationDuration: `${a.driftDur ?? 10}s`, animationDelay: `${a.delay ?? 0}s` };
    return (
      <div data-testid={testId} className={`${styles.ffly} ${styles.anim}`} style={outer}>
        {sheet(`${styles.ffGlow} ${styles.anim}`, { animationDuration: `${a.dur ?? 3}s`, animationDelay: `${a.delay ?? 0}s` })}
      </div>
    );
  }
  const cycle: Css = { animationDuration: `${a.dur ?? 6}s`, animationDelay: `${a.delay ?? 0}s` };
  const frame = kind === "still" ? "" : `${a.hold === 94 ? styles.hold94 : a.hold === 50 ? styles.flap : styles.hold85} ${styles.anim}`;
  if (a.walk) {
    return (
      <div data-testid={testId} className={`${styles.walker} ${styles.anim}`} style={{ ...at, "--tx": a.walk, animationDuration: `${a.dur}s`, animationDelay: `${a.delay}s` } as Css}>
        {sheet(frame, { animationDuration: `${a.flap ?? 0.5}s` })}
      </div>
    );
  }
  return (
    <div data-testid={testId} className={styles.animal} style={at}>
      {sheet(frame, cycle)}
    </div>
  );
}
const CLOUD_SIZE: Record<string, [number, number]> = { "cloud-a.png": [31, 12], "cloud-b.png": [17, 8] };
const px = (n: number) => `calc(${n}px * var(--k))`;

function Sprite({ testId, file, x, y, w, h, className, style }: { testId?: string; file: string; x: number; y: number; w: number; h: number; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      aria-hidden="true"
      alt=""
      data-testid={testId}
      src={`/art/${file}`}
      className={`pixelated ${styles.sprite} ${className ?? ""}`}
      style={{ left: px(x), top: px(y), width: px(w), height: px(h), ...style }}
    />
  );
}

/** Clouds start at their art position, then drift 1 art px per 400 ms to the right edge and wrap. */
function Cloud({ file, x, y }: { file: string; x: number; y: number }) {
  const [w, h] = CLOUD_SIZE[file];
  const travel = 320 + w;
  return (
    <div
      className={styles.drift}
      aria-hidden="true"
      style={
        {
          top: px(y),
          width: px(w),
          height: px(h),
          "--w": w,
          animationDuration: `${travel * 0.4}s`,
          animationTimingFunction: `steps(${travel})`,
          animationDelay: `${-(x + w) * 0.4}s`,
        } as React.CSSProperties
      }
    >
      <img src={`/art/${file}`} alt="" className="pixelated" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function Layer({ scene, active }: { scene: Scene; active: boolean }) {
  const horizon = art.horizon;
  const clouds: { file: string; x: number; y: number }[] = art[scene].clouds;
  return (
    <div className={`${styles.layer} ${scene === "night" ? styles.second : ""}`} aria-hidden={!active} data-active={active}>
      <div className={styles.art}>
        <img src={`/art/scene-${scene}.png`} alt={ALT[scene]} className={`pixelated ${styles.scene}`} />
        {scene === "night" &&
          art.stars.list.map((s, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={styles.star}
              style={{
                left: px(s.plus ? s.x - 1 : s.x),
                top: px(s.plus ? s.y - 1 : s.y),
                width: px(s.plus ? 3 : 1),
                height: px(s.plus ? 3 : 1),
                backgroundPosition: `calc(${s.plus ? 1 - s.x : -s.x}px * var(--k)) calc(${s.plus ? 1 - s.y : -s.y}px * var(--k))`,
                animationDelay: `${-((i * 1.7) % 7)}s`,
                animationDuration: `${5 + (i % 3) * 2}s`,
              }}
            />
          ))}
        {scene === "sunset" && <span aria-hidden="true" className={styles.glow} style={{ top: px(horizon - 12), height: px(12) }} />}
        {clouds.map((c, i) => (
          <Cloud key={i} {...c} />
        ))}
        {scene === "sunset" && (
          <div className={styles.birds} aria-hidden="true" style={{ top: px(art.sunset.birds.y), width: px(15), height: px(5) }}>
            <img src="/art/birds.png" alt="" className="pixelated" style={{ width: "100%", height: "100%" }} />
          </div>
        )}
        {(art[scene].animals as unknown as Animal[]).map((a) => (
          <CastMember key={a.testId} a={a} />
        ))}
        <Sprite testId="snail" file={art.snail.file} x={art.snail.x} y={art.snail.y} w={art.snail.w} h={art.snail.h} />
      </div>
    </div>
  );
}

// The hero demo marks the page with data-demo="running"; the scenery holds still while it runs.
const subscribeDemo = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-demo"] });
  return () => mo.disconnect();
};
const useDemoRunning = () => useSyncExternalStore(subscribeDemo, () => document.documentElement.dataset.demo === "running", () => false);

export default function HeroScenes() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<Scene>(() => initialScene(false));
  const [wantPlay, setPlaying] = useState(true);
  const demo = useDemoRunning();
  const playing = wantPlay && !demo;
  const root = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0); // 0 until measured, so the SSR scene never paints at the wrong scale (CLS)

  // Whole-number scale: smallest k with 320k >= width and 180k >= height.
  useLayoutEffect(() => {
    const stage = root.current?.parentElement;
    if (!stage) return;
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      setK(Math.max(1, Math.ceil(width / 320), Math.ceil(height / 180)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !playing) return;
    const t = setTimeout(() => setScene(other(scene)), nextWait());
    return () => clearTimeout(t);
  }, [scene, playing, reduced]);

  const label = reduced ? (scene === "sunset" ? "Show night" : "Show sunset") : playing ? "Pause scenery" : "Play scenery";
  const onClick = () => (reduced ? setScene(other(scene)) : setPlaying(!wantPlay));

  return (
    <div ref={root} className={styles.root} data-paused={!playing || reduced} style={{ "--k": k || 4 } as React.CSSProperties}>
      <div className={styles.track} data-testid="scene-track" data-scene={scene} style={{ transform: scene === "night" ? "translateX(-100%)" : "translateX(0)", visibility: k ? "visible" : "hidden" }}>
        <Layer scene="sunset" active={scene === "sunset"} />
        <Layer scene="night" active={scene === "night"} />
      </div>
      <button type="button" className={`btn ${styles.pause}`} onClick={onClick}>
        {label}
      </button>
    </div>
  );
}
