"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import art from "../public/art/device.json";
import styles from "./DeviceDiagram.module.css";

type Colourway = "olive" | "brown" | "black";

// Wide layout is drawn in a fixed 940 x 360 px box: labels in the outer columns, the left side face and the front in the middle.
const SIDE = { x: 190, y: 28 };
const FRONT = { x: 330, y: 28 };
const LEFT = 184; // leader line starts here for left labels
const RIGHT = 736; // ... and here for right labels
const BELOW = 328; // y where the leader lines of the labels under the front start

type Callout = {
  text: string;
  place: "l" | "r" | "b";
  ly: number; // label y in the wide box (the left and right columns), or the label's x (labels below)
  anchor: [number, number]; // where the leader ends, in the wide box
  badge: { on: "front" | "side"; x: number; y: number }; // numbered marker on the image (narrow layout), art px
};

const mid = (k: { x: number; w: number }) => k.x + k.w / 2;
const keyY = art.keys.back.y + art.keys.back.h;

const CALLOUTS: Callout[] = [
  { text: "Screen", place: "r", ly: FRONT.y + art.screen.y + 40, anchor: [FRONT.x + art.screen.x + art.screen.w - 10, FRONT.y + art.screen.y + 40], badge: { on: "front", x: art.screen.x - 14, y: art.screen.y + 14 } },
  { text: "Spiral wheel", place: "r", ly: FRONT.y + art.wheel.cy, anchor: [FRONT.x + art.wheel.cx + art.wheel.r - 8, FRONT.y + art.wheel.cy], badge: { on: "front", x: art.wheel.cx, y: art.wheel.cy - art.wheel.r - 14 } },
  { text: "Back", place: "b", ly: FRONT.x + mid(art.keys.back) - 36, anchor: [FRONT.x + mid(art.keys.back), FRONT.y + keyY - 4], badge: { on: "front", x: mid(art.keys.back), y: keyY + 16 } },
  { text: "Home", place: "b", ly: FRONT.x + mid(art.keys.home) + 36, anchor: [FRONT.x + mid(art.keys.home), FRONT.y + keyY - 4], badge: { on: "front", x: mid(art.keys.home), y: keyY + 16 } },
  { text: "USB-C", place: "l", ly: SIDE.y + art.side.usb.y - 12, anchor: [SIDE.x + art.side.usb.x, SIDE.y + art.side.usb.y], badge: { on: "side", x: 66, y: art.side.usb.y } },
  { text: "Charge light", place: "l", ly: SIDE.y + art.side.light.y, anchor: [SIDE.x + art.side.light.x, SIDE.y + art.side.light.y], badge: { on: "side", x: 66, y: art.side.light.y + 6 } },
  { text: "Power button", place: "l", ly: SIDE.y + art.side.power.y + 14, anchor: [SIDE.x + art.side.power.x, SIDE.y + art.side.power.y], badge: { on: "side", x: 66, y: art.side.power.y + 6 } },
];

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

function Badges({ on }: { on: "front" | "side" }) {
  const [w, h] = on === "front" ? [art.width, art.height] : [art.side.width, art.side.height];
  return CALLOUTS.map((c, i) =>
    c.badge.on === on ? (
      <span key={i} aria-hidden="true" className={styles.badge} style={{ left: pct(c.badge.x, w), top: pct(c.badge.y, h) }}>
        {i + 1}
      </span>
    ) : null,
  );
}

export default function DeviceDiagram({ colourway = "olive" }: { colourway?: Colourway }) {
  const root = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    // Reduced motion: nothing is armed, so everything is drawn and visible from the start.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    setArmed(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={root} className={styles.root} data-armed={armed || undefined} data-in={seen || undefined}>
      <div className={styles.stage}>
        <div className={styles.front}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pixelated" src={`/art/device-${colourway}.png`} width={art.width} height={art.height} alt="Front of the pager: the e-ink screen across the top inside a wide paper margin; below it, Back and Home keys and a small spiral logo on the left, and a round spiral wheel with a copper ring on the right." />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`pixelated ${styles.still}`}
            src="/art/home-still.png"
            width={250}
            height={122}
            alt=""
            style={{ left: pct(art.screen.x, art.width), top: pct(art.screen.y, art.height), width: pct(art.screen.w, art.width) }}
          />
          <Badges on="front" />
        </div>
        <div className={styles.side}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pixelated" src={`/art/device-side-${colourway}.png`} width={art.side.width} height={art.side.height} alt="The left side face: a USB-C port near the top, with a small charge light and the power button below it. Nothing else." />
          <Badges on="side" />
        </div>
        <svg className={styles.lines} viewBox="0 0 940 360" aria-hidden="true">
          {CALLOUTS.map((c, i) => {
            const d = c.place === "b" ? `M${c.ly} ${BELOW} L${c.anchor[0]} ${c.anchor[1]}` : `M${c.place === "l" ? LEFT : RIGHT} ${c.ly} L${c.anchor[0]} ${c.anchor[1]}`;
            return (
              <g key={i}>
                <path d={d} pathLength={1} className={`${styles.line} ${styles.halo}`} />
                <path d={d} pathLength={1} className={`${styles.line} ${styles.ink}`} />
                <circle cx={c.anchor[0]} cy={c.anchor[1]} r={4} className={styles.dot} />
              </g>
            );
          })}
        </svg>
        <ol className={styles.labels}>
          {CALLOUTS.map((c, i) => (
            <li
              key={i}
              className={c.place === "l" ? styles.left : c.place === "r" ? styles.right : styles.below}
              style={(c.place === "b" ? { "--lx": `${c.ly}px`, "--ly": `${BELOW + 14}px` } : { "--ly": `${c.ly}px` }) as unknown as CSSProperties}
            >
              {c.text}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className={styles.caption}>Prototype design, may change.</figcaption>
    </figure>
  );
}
