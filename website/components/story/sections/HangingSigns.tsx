"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { holdOpacity } from "../../../lib/world/ease";
import { getStage, subscribeStage, type Stage } from "../../../lib/world/stage";
import { artToScreen } from "../../../lib/world/tags";
import s from "./HangingSigns.module.css";

type Path = { href: string; title: string; line: string };
type Bounds = { hold: string; vw: number; vh: number; fits: boolean; lo: number; hi: number };

const GAP = 24; // 16 px clear, plus 8 px for a lifted sign
const MIN_ROW = 5 * 44 + 4 * 12 + 24; // five signs at their minimum width, the gaps, the row's padding

/**
 * The five paths as signs on a beam. While scene 9's hold is at rest (landscape, with room beside the panel), the beam is pinned to the art's `beam` anchor and drawn in the `[data-signs]` host
 * (outside the hold, which is transformed, so `position: fixed` means the screen); otherwise the signs stay in the panel's flow, face on.
 * One sign is active at a time (hover, focus, or a first touch); the caption shows its title and line.
 * The pin flips the tree between two places, which would drop focus, so while focus is inside the signs the tree stays where it is (a pinned row just fades with its hold) and flips after focus has left.
 */
export default function HangingSigns({ paths }: { paths: readonly Path[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [live, setLive] = useState(true); // false while a keyboard has focus on a link: the link's own name is read, the caption need not repeat it
  const [host, setHost] = useState<Element | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const written = useRef("");
  const touched = useRef(false); // the last pointer was a finger: a blur or a leave does not clear
  const block = useRef(false); // the click after a first tap must not navigate
  // layout facts, read once per hold or view change (and on resize), not per frame
  const bounds = useRef<Bounds | null>(null);
  const els = useRef<{ trail: Element | null; panel: Element | null; portrait: MediaQueryList | null }>({ trail: null, panel: null, portrait: null });

  const measure = (st: Stage): Bounds => {
    const e = els.current;
    if (!e.trail?.isConnected) e.trail = document.querySelector("nav[data-trail]");
    if (!e.panel?.isConnected) e.panel = document.querySelector('[data-hold="s9-hold"] [data-panel]');
    e.portrait ??= matchMedia("(orientation: portrait)");
    let lo = GAP;
    let hi = innerWidth - GAP;
    const trail = e.trail?.getBoundingClientRect();
    if (trail && trail.width) hi = Math.min(hi, trail.left - GAP);
    const pr = e.panel?.getBoundingClientRect();
    if (pr && pr.width) { if (pr.left + pr.right < innerWidth) lo = Math.max(lo, pr.right + GAP); else hi = Math.min(hi, pr.left - GAP); }
    // No room beside the panel (a short landscape screen has a wide one) or a tall screen: the signs stay in its flow, compact.
    return { hold: st.hold, vw: st.view.w, vh: st.view.h, lo, hi, fits: !e.portrait.matches && hi - lo >= 300 };
  };

  const place = useCallback((st: Stage | null) => {
    const beam = st?.art.anchors.beam;
    const el = root.current;
    let b: Bounds | null = null;
    if (st && beam && st.hold === "s9-hold") {
      b = bounds.current;
      if (!b || b.hold !== st.hold || b.vw !== st.view.w || b.vh !== st.view.h) b = bounds.current = measure(st);
    }
    // The row hangs from the drawn beam, post to post; if that span is not wholly in the free room or too narrow for five signs, the signs stay in the flow.
    const pl = st && b?.fits && st.art.anchors.beam_l ? artToScreen(st.art.anchors.beam_l, st.art, st.cam, st.view, st.k, st.dpr) : null;
    const pr = st && b?.fits && st.art.anchors.beam_r ? artToScreen(st.art.anchors.beam_r, st.art, st.cam, st.view, st.k, st.dpr) : null;
    const canPin = !!(b && pl && pr && pl.x >= b.lo && pr.x <= b.hi && pr.x - pl.x >= MIN_ROW);
    // While focus is inside the signs the tree does not move (a moved node loses focus, and restoring it would yank the page back to the hold):
    // a pinned row fades out with its hold and flips only once focus has left.
    if (el && el.contains(document.activeElement)) {
      if (!canPin && el.hasAttribute("data-pinned")) { el.style.opacity = "0"; el.dataset.on = "false"; }
      if (!canPin || !el.hasAttribute("data-pinned")) return;
    } else setPinned(canPin);
    if (!st || !pl || !pr || !el?.hasAttribute("data-pinned")) return;
    el.style.opacity = String(holdOpacity(st.holdT));
    el.dataset.on = String(holdOpacity(st.holdT) > 0.5); // a hold fading in or out takes no clicks, like its panel
    const w = pr.x - pl.x;
    const v = `translate(${pl.x}px, ${pl.y}px)`;
    if (written.current === v + w) return;
    written.current = v + w;
    el.style.width = `${w}px`;
    el.style.transform = v;
  }, []);

  useEffect(() => {
    setHost(document.querySelector("[data-signs]"));
    const resize = () => { bounds.current = null; place(getStage()); };
    addEventListener("resize", resize);
    const off = subscribeStage(place);
    return () => { removeEventListener("resize", resize); off(); };
  }, [place]);
  useLayoutEffect(() => {
    written.current = ""; // a new element after the move
    place(getStage());
  }, [pinned, host, place]);

  useEffect(() => {
    if (active === null) return;
    const away = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !root.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [active]);

  const clear = () => {
    if (!touched.current) setActive(null);
    setTimeout(() => place(getStage()), 0); // focus has settled: take a flip that waited for it
  };
  const tree = (
    <div ref={root} className={s.root} data-pinned={pinned ? "" : undefined}>
      <ul className={s.signs} data-pinned={pinned || undefined} onKeyDown={() => { touched.current = false; block.current = false; }}>
        {paths.map((p, i) => (
          <li
            key={p.href}
            data-testid="explore-path"
            className={s.sign}
            data-active={active === i || undefined}
            data-aside={active === null || active === i ? undefined : i < active ? "left" : "right"}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") { touched.current = false; setLive(true); setActive(i); } }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
            onPointerCancel={() => { block.current = false; }}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse") return void (touched.current = false);
              touched.current = true;
              block.current = active !== i;
              if (active !== i) setActive(i);
            }}
          >
            <Link
              href={p.href}
              className={s.link}
              onFocus={(e) => { setLive(!e.currentTarget.matches(":focus-visible")); setActive(i); }}
              onBlur={clear}
              onClick={(e) => { if (block.current) { e.preventDefault(); block.current = false; } }}
            >
              <span className={s.title}>{p.title}</span>
              <span className={s.sr}>{p.line}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={s.caption} data-testid="sign-caption" aria-live={live ? "polite" : "off"} data-on={active !== null}>
        {active !== null && (<><strong>{paths[active].title}</strong> <span>{paths[active].line}</span></>)}
      </p>
    </div>
  );
  return pinned && host ? createPortal(tree, host) : tree;
}
