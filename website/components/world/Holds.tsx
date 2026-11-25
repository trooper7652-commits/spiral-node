"use client";

import { createContext, useEffect, useRef, type ReactNode } from "react";
import { holdOpacity } from "../../lib/world/ease";
import { holdPx } from "../../lib/world/frame";
import type { Frame, World } from "../../lib/world/types";
import s from "./holds.module.css";
import { vhPx } from "./vh";

/** The current frame, for parts that move with hold progress. Holds' children keep their identity, so only readers re-render. */
export const HoldFrame = createContext<Frame | null>(null);

// Where a panel sits (holds.module.css has the same numbers): its top on a wide screen, the gap under a bottom sheet (the trail bar's strip), and the gap kept above the footer.
const TOP = 96;
const SHEET_BOTTOM = 72;
const SHORT_TOP = 8; // its top on a landscape screen under 500 px tall
const GAP = 16;

/** Sections (`<section data-hold="id">`) shown over the art only while their hold is active, each as one panel docked by CSS (`data-dock`). Styles go straight to the DOM: no React render per frame. */
export default function Holds({ world, frame, children }: { world: World; frame: Frame | null; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const hold = useRef<string | null>(null);
  hold.current = frame?.hold ?? null;

  // Before the first frame (and with JS off) the sections are plain content in flow.
  useEffect(() => {
    if (frame) root.current!.dataset.live = "";
  }, [frame]);

  // Panel heights are kept as they change (width, content, fonts), so a frame never forces a layout to read them.
  const heights = useRef(new Map<Element, number>());
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) heights.current.set(e.target, e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight);
    });
    root.current!.querySelectorAll("[data-hold]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // The footer is part of the page and scrolls up over the last shot; it pushes a panel still on screen up ahead of it, so the two never overlap.
  const footerDoc = useRef(Infinity);
  useEffect(() => {
    const f = document.querySelector("footer");
    if (!f) return;
    // a footer that is not laid out (display: none) reports top 0, which would push every hold off screen
    const read = () => { const b = f.getBoundingClientRect(); footerDoc.current = b.height ? b.top + scrollY : Infinity; };
    const ro = new ResizeObserver(read);
    ro.observe(f);
    ro.observe(document.body);
    read();
    return () => ro.disconnect();
  }, []);

  // A write that changes nothing still costs a style pass, so only changed values reach the DOM.
  const written = useRef(new WeakMap<HTMLElement, Map<string, string>>());
  const put = (el: HTMLElement, key: string, value: string) => {
    let m = written.current.get(el);
    if (!m) written.current.set(el, (m = new Map()));
    if (m.get(key) === value) return;
    m.set(key, value);
    if (key.startsWith("--")) el.style.setProperty(key, value);
    else (el.style as unknown as Record<string, string>)[key] = value;
  };

  useEffect(() => {
    if (!frame) return; // until the first frame the sections stay visible in flow
    const sheet = innerHeight >= innerWidth; // the same test as the CSS (orientation: portrait)
    const footerTop = footerDoc.current - scrollY;
    for (const el of root.current!.querySelectorAll<HTMLElement>("[data-hold]")) {
      const on = frame.hold === el.dataset.hold;
      const o = on ? holdOpacity(frame.holdT ?? 0) : 0;
      if (on) {
        const bottom = sheet ? innerHeight - SHEET_BOTTOM : (innerHeight <= 500 ? SHORT_TOP : TOP) + (heights.current.get(el) ?? el.offsetHeight);
        put(el, "--push", String(Math.max(0, bottom - (footerTop - GAP))));
        // the word is whole from 0.5 on, so later values would restyle every letter for nothing
        put(el, "--hold-t", String(Math.min(frame.holdT ?? 0, 0.5)));
      }
      put(el, "opacity", String(Math.round(o * 4) / 4)); // a fade in four hard steps, like the art
      put(el, "pointerEvents", o > 0.5 ? "auto" : "none");
    }
  }, [frame]);

  // A link tabbed to inside a section that is not the live one scrolls its hold into view.
  const focusIn = (e: React.FocusEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-hold]")?.dataset.hold;
    if (id && id !== hold.current) scrollTo({ top: holdPx(world, id, { w: innerWidth, h: vhPx() }), behavior: "instant" });
  };

  return (
    <div ref={root} className={s.holds} onFocus={focusIn}>
      <HoldFrame.Provider value={frame}>{children}</HoldFrame.Provider>
    </div>
  );
}
