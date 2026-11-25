"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { SECTIONS } from "../../lib/world/home";
import { holdPx } from "../../lib/world/frame";
import type { World } from "../../lib/world/types";
import s from "./TrailMeter.module.css";
import { vhPx } from "./vh";

const NAMES = ["Countryside", "Desk", "Shell", "Device", "Scroll", "Map", "Star atlas", "Town square", "Dawn hill"];
const FIGURES = ["newton", "leonardo", "anning", "faraday", "lovelace", "idrisi", "galileo", "socrates", "newton"]; // the walker in each scene (scene 9, all eight together, shows the first)

/** The nine scenes as waypoints on a trail: done ones olive, the current one orange, the walker and dog standing at the current one. `index` -1 is the opening, before scene 1: no waypoint is current, the chip reads START and the crew stands just before waypoint 1. `index` comes from the frames the canvas already reports, so this adds no scroll handler. */
function TrailMeter({ world, index }: { world: World; index: number }) {
  const nav = useRef<HTMLElement>(null);
  const prev = useRef(index);
  const currentFigure = FIGURES[Math.max(index, 0)];

  // The crew walks (2-frame cycle) only while it is moving between waypoints, facing the way it goes.
  useEffect(() => {
    if (prev.current === index) return;
    nav.current!.dataset.dir = index > prev.current ? "fwd" : "back";
    nav.current!.dataset.moving = "";
    prev.current = index;
  }, [index]);

  const stop = () => delete nav.current!.dataset.moving; // also on a cancelled step, or the walk cycle would run on

  // A near target scrolls smoothly; a far one (over 3 screens) lands at once, as the world paints the target shot directly and a smooth scroll over that distance is too slow.
  const go = (i: number) => {
    const h = vhPx();
    const top = holdPx(world, `${SECTIONS[i]}-hold`, { w: innerWidth, h });
    const near = Math.abs(top - scrollY) <= 3 * h;
    scrollTo({ top, behavior: near && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
  };

  return (
    <nav ref={nav} className={s.trail} aria-label="Scenes" data-trail="" data-dir="fwd" data-start={index < 0 ? "" : undefined}>
      <div className={s.chip} data-trail-chip="" aria-hidden="true">
        {index < 0 ? "START" : `${index + 1}/9 ${NAMES[index]}`.toUpperCase()}
      </div>
      <div className={s.track}>
        {NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            className={s.stop}
            style={{ "--i": i } as CSSProperties}
            aria-label={`Scene ${i + 1}: ${name}`}
            aria-current={i === index ? "step" : undefined}
            data-state={i < index ? "done" : i === index ? "here" : "ahead"}
            onClick={() => go(i)}
          >
            <span className={s.dot} aria-hidden="true" />
          </button>
        ))}
        <div className={s.crew} style={{ "--i": Math.max(index, -0.3) } as CSSProperties} aria-hidden="true" onTransitionEnd={stop} onTransitionCancel={stop}>
          <span className={`${s.sprite} ${s.dog}`} />
          <span className={`${s.sprite} ${s.walker}`} data-figure={currentFigure} style={{ "--row": FIGURES.indexOf(currentFigure) } as CSSProperties} />
        </div>
      </div>
    </nav>
  );
}

export default memo(TrailMeter);
