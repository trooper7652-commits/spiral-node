"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { holdOpacity } from "../../../lib/world/ease";
import { getStage, subscribeStage, type Stage } from "../../../lib/world/stage";
import { artToScreen } from "../../../lib/world/tags";
import s from "./ScriptScreens.module.css";

type Sample = { id: string; title: string; sample: string; href: string };
type Bounds = { hold: string; vw: number; vh: number; lo: number; hi: number; bottom: number; flow: boolean };

const GAP = 16;
const MAX_W = 240;
const MIN_W = 180;
const MAX_H = 150; // a screen with a three-line sample, with room to spare
const LIFT = 8; // the screen's top edge sits this far above its anchor

/**
 * Three e-paper screens, each a link to its script. While scene 5's hold is at rest (landscape, with room beside the panel) they are drawn in the `[data-screens]` host
 * (outside the hold, which is transformed) at the art's `screen1..3` anchors; otherwise they stack in the panel's flow.
 * The pin moves the tree between two places, which would drop focus, so while focus is inside it the tree stays and flips after focus has left.
 */
export default function ScriptScreens({ samples }: { samples: readonly Sample[] }) {
  const [pinned, setPinned] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const root = useRef<HTMLUListElement>(null);
  const bounds = useRef<Bounds | null>(null);
  const els = useRef<{ trail: Element | null; panel: Element | null; portrait: MediaQueryList | null }>({ trail: null, panel: null, portrait: null });

  const measure = (st: Stage): Bounds => {
    const e = els.current;
    if (!e.trail?.isConnected) e.trail = document.querySelector("nav[data-trail]");
    if (!e.panel?.isConnected) e.panel = document.querySelector('[data-hold="s5-hold"] [data-panel]');
    e.portrait ??= matchMedia("(orientation: portrait)");
    let lo = GAP;
    let hi = innerWidth - GAP;
    let bottom = innerHeight - GAP;
    const t = e.trail?.getBoundingClientRect();
    if (t && t.width) { if (t.width > innerWidth / 2) bottom = Math.min(bottom, t.top - GAP); else hi = Math.min(hi, t.left - GAP); }
    const p = e.panel?.getBoundingClientRect();
    if (p && p.width) { if (p.left + p.right < innerWidth) lo = Math.max(lo, p.right + GAP); else hi = Math.min(hi, p.left - GAP); }
    return { hold: st.hold, vw: st.view.w, vh: st.view.h, lo, hi, bottom, flow: e.portrait.matches };
  };

  const place = useCallback((st: Stage | null) => {
    const el = root.current;
    let b: Bounds | null = null;
    if (st && st.hold === "s5-hold") {
      b = bounds.current;
      if (!b || b.hold !== st.hold || b.vw !== st.view.w || b.vh !== st.view.h) b = bounds.current = measure(st);
    }
    const at = st && b && !b.flow ? (["screen1", "screen2", "screen3"] as const).map((n) => st.art.anchors[n] && artToScreen(st.art.anchors[n], st.art, st.cam, st.view, st.k, st.dpr)) : null;
    let w = 0;
    let shift = 0;
    let canPin = false;
    if (b && at && at.every(Boolean)) {
      const [a, m, c] = at as { x: number; y: number }[];
      // three side by side, none wider than the room between neighbours; narrower than MIN_W they stay in the flow
      w = Math.min(MAX_W, Math.floor(Math.min(m.x - a.x, c.x - m.x)) - 4);
      // the row slides left, as one, to stay clear of the panel (each screen still sits over its own device)
      shift = Math.max(0, c.x + w / 2 - b.hi);
      const top = Math.min(a.y, m.y, c.y) - LIFT - MAX_H;
      canPin = w >= MIN_W && a.x - shift - w / 2 >= b.lo && top >= GAP && top + MAX_H <= b.bottom;
    }
    if (el && el.contains(document.activeElement)) {
      if (!canPin && el.hasAttribute("data-pinned")) { el.style.opacity = "0"; el.dataset.on = "false"; }
      if (!canPin || !el.hasAttribute("data-pinned")) return;
    } else setPinned(canPin);
    if (!st || !at || !canPin || !el?.hasAttribute("data-pinned")) return;
    const o = holdOpacity(st.holdT);
    el.style.opacity = String(o);
    el.dataset.on = String(o > 0.5); // a hold fading in or out takes no clicks, like its panel
    el.querySelectorAll<HTMLElement>("li").forEach((li, i) => {
      const p = at[i]!;
      li.style.width = `${w}px`;
      // the screen's bottom edge sits just above its anchor
      li.style.transform = `translate(${p.x - shift - w / 2}px, ${p.y - LIFT - li.offsetHeight}px)`;
    });
  }, []);

  useEffect(() => {
    setHost(document.querySelector("[data-screens]"));
    const resize = () => { bounds.current = null; place(getStage()); };
    addEventListener("resize", resize);
    const off = subscribeStage(place);
    return () => { removeEventListener("resize", resize); off(); };
  }, [place]);
  useLayoutEffect(() => place(getStage()), [pinned, host, place]);

  const tree = (
    <ul ref={root} className={s.screens} data-testid="script-screens" data-pinned={pinned ? "" : undefined} onBlur={() => setTimeout(() => place(getStage()), 0)}>
      {samples.map((x) => (
        <li key={x.id} className={s.item}>
          <Link href={x.href} className={s.screen} data-testid="script-screen">
            <span className={s.title}>{x.title}</span>
            <span className={s.sample}>{x.sample}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return pinned && host ? createPortal(tree, host) : tree;
}
