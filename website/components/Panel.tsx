"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BLINK_MS, shouldBlink } from "@/lib/panel";
import styles from "./Panel.module.css";

type Props = { label: string; count?: string; blinkKey?: string | number; as?: "section" | "div" | "aside"; children: ReactNode };

// One throttle for every panel: a fast scroll flashes at most three times a second whichever panels it passes.
let lastBlink = -Infinity;

/**
 * The paper panel. blinkKey: a change plays the e-ink blink (0 = not on screen, so no blink for going dark).
 * Where a page places it (a hold in the home world) it can set --edge-pad, --panel-pad, --bar-pad and --bar-gap on the panel to tighten it, and turn off the pop-in.
 */
export default function Panel({ label, count, blinkKey, as: As = "div", children }: Props) {
  const prev = useRef(blinkKey);
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = blinkKey;
    const now = performance.now();
    if (!shouldBlink(was, blinkKey, now - lastBlink)) return;
    lastBlink = now;
    setBlink(false);
    // restart the animation on the next frame, then drop the class when it ends
    const raf = requestAnimationFrame(() => setBlink(true));
    const t = window.setTimeout(() => setBlink(false), BLINK_MS + 50);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [blinkKey]);
  return (
    <As data-panel="" className={`${styles.shadow} ${blink ? `${styles.blink} blink` : ""}`}>
      <div className={styles.edge}>
        <div className={styles.panel}>
          <div className={styles.bar}><span>{label}</span>{count ? <span>{count}</span> : null}</div>
          {children}
        </div>
      </div>
    </As>
  );
}
