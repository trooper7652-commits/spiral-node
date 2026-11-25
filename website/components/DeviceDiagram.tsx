"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import art from "../public/art/device.json";
import DeviceInk from "./DeviceInk";
import styles from "./DeviceDiagram.module.css";

// Wide layout is drawn in a fixed 620 x 480 px box: the top face above the front on the left, labels around them (above the top face, right of both, below the front).
const TOP = { x: 8, y: 56 };
const FRONT = { x: 8, y: 152 };
const RIGHT = 414; // leader lines of the right labels start here
const ABOVE = 40; // y where the leader lines of the labels above the top face start
const BELOW = 444; // y where the leader lines of the labels under the front start

type Callout = {
  text: string;
  place: "r" | "a" | "b";
  ly: number; // label y in the wide box (the right column), or the label's x (labels above or below)
  anchors: [number, number][]; // where the leaders end, in the wide box
  badges: { on: "front" | "top"; x: number; y: number }[]; // numbered markers on the images (narrow layout), art px
};

const mid = (k: { x: number; w: number }) => k.x + k.w / 2;
const keyY = art.keys.back.y + art.keys.back.h;
const [usb1, usb2] = art.top.usb;
const onTop = (x: number) => ({ on: "top" as const, x, y: -6 }); // just above the top face's edge, clear of the parts

const CALLOUTS: Callout[] = [
  { text: "Screen", place: "r", ly: FRONT.y + art.screen.y + 40, anchors: [[FRONT.x + art.screen.x + art.screen.w - 10, FRONT.y + art.screen.y + 40]], badges: [{ on: "front", x: art.screen.x - 14, y: art.screen.y + 14 }] },
  { text: "Spiral wheel", place: "r", ly: FRONT.y + art.wheel.cy, anchors: [[FRONT.x + art.wheel.cx + art.wheel.r - 8, FRONT.y + art.wheel.cy]], badges: [{ on: "front", x: art.wheel.cx, y: art.wheel.cy - art.wheel.r - 14 }] },
  { text: "Back", place: "b", ly: FRONT.x + mid(art.keys.back) - 36, anchors: [[FRONT.x + mid(art.keys.back), FRONT.y + keyY - 4]], badges: [{ on: "front", x: mid(art.keys.back), y: keyY + 16 }] },
  { text: "Home", place: "b", ly: FRONT.x + mid(art.keys.home) + 36, anchors: [[FRONT.x + mid(art.keys.home), FRONT.y + keyY - 4]], badges: [{ on: "front", x: mid(art.keys.home), y: keyY + 16 }] },
  { text: "USB-C", place: "a", ly: TOP.x + (usb1.x + usb2.x) / 2, anchors: art.top.usb.map((u) => [TOP.x + u.x, TOP.y + u.y]), badges: art.top.usb.map((u) => onTop(u.x)) },
  { text: "Charge light", place: "a", ly: TOP.x + art.top.light.x + 44, anchors: [[TOP.x + art.top.light.x, TOP.y + art.top.light.y]], badges: [onTop(art.top.light.x)] },
  { text: "Power button", place: "r", ly: TOP.y + art.top.power.y, anchors: [[TOP.x + art.top.power.x + 12, TOP.y + art.top.power.y]], badges: [onTop(art.top.power.x)] },
];

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

function Badges({ on }: { on: "front" | "top" }) {
  const [w, h] = on === "front" ? [art.width, art.height] : [art.top.width, art.top.height];
  return CALLOUTS.flatMap((c, i) =>
    c.badges
      .filter((b) => b.on === on)
      .map((b, j) => (
        <span key={`${i}-${j}`} aria-hidden="true" className={styles.badge} style={{ left: pct(b.x, w), top: pct(b.y, h) }}>
          {i + 1}
        </span>
      )),
  );
}

export default function DeviceDiagram() {
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
        <div className={styles.top}>
          <DeviceInk face="top" label="The top face: two USB-C ports side by side near the middle, a small charge light just right of them and the power button toward the right end. Nothing on the left." />
          <Badges on="top" />
        </div>
        <div className={styles.front}>
          <DeviceInk face="front" label="Front of the pager: the e-ink screen across the top inside a wide paper margin; below it, Back and Home keys and a small spiral logo on the left, and a round spiral wheel with an orange ring on the right." />
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
        <svg className={styles.lines} viewBox="0 0 620 480" aria-hidden="true">
          {CALLOUTS.map((c, i) => {
            const from = c.place === "b" ? [c.ly, BELOW] : c.place === "a" ? [c.ly, ABOVE] : [RIGHT, c.ly];
            return (
              <g key={i}>
                {c.anchors.map((a, j) => {
                  const d = `M${from[0]} ${from[1]} L${a[0]} ${a[1]}`;
                  return (
                    <g key={j}>
                      <path d={d} pathLength={1} className={`${styles.line} ${styles.halo}`} />
                      <path d={d} pathLength={1} className={`${styles.line} ${styles.ink}`} />
                      <circle cx={a[0]} cy={a[1]} r={4} className={styles.dot} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <ol className={styles.labels}>
          {CALLOUTS.map((c, i) => (
            <li
              key={i}
              className={c.place === "r" ? styles.right : styles.below}
              style={(c.place === "b" ? { "--lx": `${c.ly}px`, "--ly": `${BELOW + 14}px` } : c.place === "a" ? { "--lx": `${c.ly}px`, "--ly": `${ABOVE - 14}px` } : { "--ly": `${c.ly}px` }) as unknown as CSSProperties}
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
