"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { holdOpacity } from "../../lib/world/ease";
import { getStage, subscribeStage, type Stage } from "../../lib/world/stage";
import { artToScreen, tagDepth, TAG_REACH, TAG_SPOTS, type TagItem } from "../../lib/world/tags";
import type { SceneArt } from "../../lib/world/types";
import s from "./Tags.module.css";

const NAMED = ["s3", "s4"]; // the tags of these show their names; the others a number (their names are whole sentences)
const HALF = 15; // an object's half-width in art px when it has no sprite of its own (they are about 26 wide)
const STAR = 4; // a star is a few art px across; scene 7 labels sit this close
const GAP = 6;
const DOT = 12; // half the square kept clear round a part's anchor, CSS px
type Box = { x: number; y: number; w: number; h: number };
const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (r: DOMRect | undefined): Box | null => (r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
const GROUP: Record<string, string> = { s3: "Features on the picture", s4: "Parts on the picture", s6: "Roadmap on the picture", s7: "Questions on the picture" };

/**
 * One small paper tag per item, pinned to its art point in the shot at rest in `section`'s hold.
 * Positions go straight to the DOM when the stage changes (no React render per frame). The group is one tab stop: arrows move inside it, Enter or Space picks.
 */
export default function Tags({ section, items, picked, chips, onPick }: { section: string; items: TagItem[]; picked: string | null; chips: boolean; onPick: (id: string) => void }) {
  const hold = `${section}-hold`;
  const [art, setArt] = useState<SceneArt | null>(null);
  const [active, setActive] = useState<string | null>(null); // the roving tab stop
  const group = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLButtonElement>());
  const written = useRef(new Map<string, string>());
  const glow = useRef<HTMLDivElement>(null);
  const leaders = useRef<SVGSVGElement>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const place = useCallback(
    (st: Stage | null) => {
      const g = group.current;
      if (!g || !st || st.hold !== hold) {
        if (glow.current) glow.current.style.opacity = "0";
        return;
      }
      const o = holdOpacity(st.holdT);
      if (chips && section !== "s7") return; // chips sit in the panel's row, not on the art
      if (chips) { // scene 7's chips: only the picked star's glow is on the art
        const t = st.art.tags.find((t) => t.id === pickedRef.current);
        const gl = glow.current;
        if (gl) {
          gl.style.opacity = t ? String(o) : "0";
          if (t) { const p = artToScreen({ x: t.x, y: t.y, depth: t.depth ?? tagDepth(st.art) }, st.art, st.cam, st.view, st.k, st.dpr); gl.style.translate = `${p.x}px ${p.y}px`; }
        }
        return;
      }
      const depth = tagDepth(st.art);
      g.style.opacity = String(o);
      g.dataset.on = String(o > 0.5); // a hold fading in or out takes no clicks, like its panel
      const cards = section === "s3" || section === "s7";
      const lead = section === "s4"; // scene 4: labels beside their parts, each joined by a leader line
      const sc = st.k / st.dpr; // CSS px per art px
      const wide = section === "s7" ? 230 : 220;
      const avoid: Box[] = cards || lead ? [document.querySelector(`[data-hold="${hold}"] [data-panel]`), document.querySelector("nav[data-trail]")].map((e) => box(e?.getBoundingClientRect())).filter((b): b is Box => !!b) : [];
      const pts = st.art.tags.map((t) => artToScreen({ x: t.x, y: t.y, depth: t.depth ?? depth }, st.art, st.cam, st.view, st.k, st.dpr));
      // each object's half-width, CSS px: its own sprite's (scene 3's feat-<id>), a star's in scene 7
      const halves = st.art.tags.map((t) => ((section === "s7" ? STAR : (st.art.sprites.find((x) => x.id === `feat-${t.id}`)?.w ?? 2 * HALF) / 2) * st.k) / st.dpr);
      // the objects (and the figure) are not to be covered by any card
      const things: Box[] = cards ? st.art.tags.map((t, i) => (t.id.startsWith("who") ? { x: pts[i].x - 2 * halves[i], y: pts[i].y - 4 * halves[i], w: 4 * halves[i], h: 8 * halves[i] } : { x: pts[i].x - halves[i], y: pts[i].y - halves[i], w: 2 * halves[i], h: 2 * halves[i] })) : [];
      const placed: Box[] = [];
      const dots: Box[] = lead ? st.art.tags.flatMap((t, i) => (els.current.has(t.id) ? [{ x: pts[i].x - DOT, y: pts[i].y - DOT, w: 2 * DOT, h: 2 * DOT }] : [])) : []; // no label covers any part's anchor
      // a leader line from the label's edge to the anchor: straight when level or plumb with it, else one elbow (horizontal, then vertical); whole pixels, hard edges
      const leader = (id: string, b: Box, p: { x: number; y: number }) => {
        const g = leaders.current?.querySelector(`[data-leader="${id}"]`);
        if (!g) return;
        const [px, py] = [Math.round(p.x), Math.round(p.y)];
        const [bx, by, bw, bh] = [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)];
        const mid = by + Math.round(bh / 2);
        const line: [number, number][] =
          py >= by && py <= by + bh ? [[px < bx ? bx : bx + bw, py], [px, py]]
          : px >= bx && px <= bx + bw ? [[px, py < by ? by : by + bh], [px, py]]
          : [[px < bx ? bx : bx + bw, mid], [px, mid], [px, py]];
        const d = line.map((q) => q.join(",")).join(" ");
        const [halo, ink, dot] = Array.from(g.children);
        halo.setAttribute("points", d);
        ink.setAttribute("points", d);
        dot.setAttribute("x", String(px - 4));
        dot.setAttribute("y", String(py - 4));
      };
      const gl = glow.current;
      if (gl) {
        const t = st.art.tags.findIndex((t) => t.id === pickedRef.current);
        gl.style.opacity = t < 0 ? "0" : String(o);
        if (t >= 0) gl.style.translate = `${pts[t].x}px ${pts[t].y}px`;
      }
      for (const [i, t] of st.art.tags.entries()) {
        const el = els.current.get(t.id);
        if (!el) continue;
        const p = pts[i];
        let v = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        if (cards) {
          // beside the object: to its right, or to its left when the right would meet the panel, the trail, another card or another object
          const r = halves[i] + GAP;
          const clear = (b: Box) => b.x >= 4 && b.x + b.w <= innerWidth - 4 && ![...avoid, ...placed, ...things.filter((_, j) => j !== i)].some((a) => meets(a, b));
          // on a smaller screen the card narrows (its line wraps more) before it gives up a clear spot
          let spot!: Box;
          let fit = wide;
          for (const mw of [wide, 170, 140]) {
            el.style.maxWidth = `${mw}px`;
            const [w, h] = [el.offsetWidth, el.offsetHeight];
            const spots: Box[] = [{ x: p.x + r, y: p.y - h / 2, w, h }, { x: p.x - r - w, y: p.y - h / 2, w, h }];
            const found = spots.find(clear);
            if (found) { spot = found; fit = mw; break; }
            if (mw === wide) spot = spots[0]; // none clear: the widest, to the right
          }
          el.style.maxWidth = `${fit}px`;
          placed.push(spot);
          v = `${spot.x}px ${spot.y}px`;
        } else if (lead) {
          // off its part: the first of the part's spots that is on screen and clear of the panel, the trail, every anchor, its own part and the labels placed before it
          const reach = TAG_REACH[t.id];
          const own = reach ? [{ x: p.x + reach.l * sc, y: p.y + reach.t * sc, w: (reach.r - reach.l) * sc, h: (reach.b - reach.t) * sc }] : [];
          const [w, h] = [el.offsetWidth, el.offsetHeight];
          const spots: Box[] = (TAG_SPOTS[t.id] ?? [[0, 0]]).map(([dx, dy]) => ({ x: Math.round(p.x + dx * sc - w / 2), y: Math.round(p.y + dy * sc - h / 2), w, h }));
          const onScreen = (b: Box) => b.x >= 4 && b.y >= 4 && b.x + b.w <= innerWidth - 4 && b.y + b.h <= innerHeight - 4;
          const clear = (b: Box) => onScreen(b) && ![...avoid, ...placed, ...dots, ...own].some((a) => meets(a, b));
          const offParts = (b: Box) => ![...dots, ...own].some((a) => meets(a, b));
          // none fully clear: give up the panel and the trail first, then other labels, then the screen edge; never a part
          const spot = spots.find(clear) ?? spots.find((b) => onScreen(b) && offParts(b) && !placed.some((a) => meets(a, b))) ?? spots.find((b) => onScreen(b) && offParts(b)) ?? spots.find(offParts) ?? spots[0];
          placed.push(spot);
          v = `translate(${spot.x}px, ${spot.y}px)`;
          leader(t.id, spot, p);
        }
        if (written.current.get(t.id) === v) continue;
        written.current.set(t.id, v);
        // a card's own transform is its hover lift, so its place goes in `translate`
        if (cards) el.style.translate = v;
        else el.style.transform = v;
      }
    },
    [hold, chips, section],
  );

  // Scrolls the chip row (not the page) so the chip is whole inside it.
  const reveal = (el: HTMLElement | undefined) => {
    const row = group.current;
    if (!chips || !el || !row) return;
    const l = el.offsetLeft; // the row is the chips' offset parent
    // to the chip's own snap point (its start), or the row's snap would pull a partway scroll back
    if (l < row.scrollLeft + 8 || l + el.offsetWidth > row.scrollLeft + row.clientWidth - 8) row.scrollLeft = Math.max(l - 8, 0);
  };

  useEffect(() => {
    const on = (st: Stage | null) => {
      setArt(st && st.hold === hold ? st.art : null);
      place(st);
    };
    on(getStage());
    return subscribeStage(on);
  }, [hold, place]);
  useLayoutEffect(() => {
    written.current.clear();
    place(getStage());
    if (picked) reveal(els.current.get(picked)); // after the picked chip has taken its line and widened
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reveal reads only refs and `chips`, which `place` already tracks
  }, [art, place, picked]);

  if (!art) return null;
  const card = (section === "s3" || section === "s7") && !chips; // scene 3 on a landscape screen: the tags are cards beside their objects
  const has = new Set(art.tags.map((t) => t.id));
  const shown = items.filter((i) => has.has(i.id));
  const tab = shown.some((i) => i.id === active) ? active : shown[0]?.id;

  const move = (e: React.KeyboardEvent) => {
    const at = shown.findIndex((i) => i.id === tab);
    const to = ({ ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: shown.length - 1 } as Record<string, number>)[e.key];
    if (to === undefined || !shown.length) return;
    e.preventDefault();
    const id = shown[(to + shown.length) % shown.length].id;
    setActive(id);
    const el = els.current.get(id);
    el?.focus({ preventScroll: true });
    reveal(el);
  };

  const mark = section === "s7" && createPortal(<div ref={glow} className={s.glow} data-glow aria-hidden="true" />, document.body);
  return (
    <>
    {mark}
    <div ref={group} role="group" aria-label={GROUP[section]} data-tagset={section} className={chips ? `${s.group} ${s.chips}` : s.group} onKeyDown={move}>
      {section === "s4" && !chips && (
        <svg ref={leaders} className={s.leaders} aria-hidden="true" focusable="false">
          {shown.map((it) => (
            <g key={it.id} data-leader={it.id}>
              <polyline className={s.halo} />
              <polyline className={s.ink} />
              <rect className={s.end} width={8} height={8} />
            </g>
          ))}
        </svg>
      )}
      {shown.map((it, n) => (
        <button
          key={it.id}
          ref={(el) => void (el ? els.current.set(it.id, el) : els.current.delete(it.id))}
          type="button"
          className={card ? `${s.tag} ${s.card}` : s.tag}
          tabIndex={it.id === tab ? 0 : -1}
          aria-pressed={picked === it.id}
          onFocus={(e) => { setActive(it.id); if (e.currentTarget.matches(":focus-visible")) reveal(e.currentTarget); }} // a pointer pick is revealed after its click (the layout effect); scrolling on mousedown would move the chip out from under the click
          onClick={(e) => { onPick(it.id); reveal(e.currentTarget); }}
        >
          {/* the name differs from the item's own button or text in the page, so a screen reader can tell the two apart */}
          <span aria-hidden="true">{NAMED.includes(section) || section === "s7" ? it.label : n + 1}</span>
          {/* a card always shows its line; a chip shows it once it is picked */}
          {it.line && (card || picked === it.id) && <span className={s.line} aria-hidden="true">{it.line}</span>}
          <span className={s.sr}>{it.label} (on the picture)</span>
        </button>
      ))}
    </div>
    </>
  );
}
