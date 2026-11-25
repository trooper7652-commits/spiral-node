"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FIGURES, whoLabel } from "../../lib/figures";
import { holdOpacity } from "../../lib/world/ease";
import { getStage, subscribeStage, type Stage } from "../../lib/world/stage";
import { artToScreen, tagDepth } from "../../lib/world/tags";
import type { SceneArt } from "../../lib/world/types";
import s from "./Names.module.css";

const HIT = 44; // the least side of a figure's invisible button, CSS px
const GAP = 6;

type Box = { x: number; y: number; w: number; h: number };
const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (r: DOMRect | undefined): Box | null => (r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);

/**
 * The name tags of a hold's figures: over each figure (the art tags `who` / `who-<id>`) a small invisible button; hover, focus or a tap shows a paper chip with the name and years.
 * The buttons are one tab stop (arrows move between figures, as in Tags). The chip goes above its figure, or below, right or left when above would meet the panel, the trail meter or the screen edge.
 */
export default function Names({ section }: { section: string }) {
  const hold = `${section}-hold`;
  const [art, setArt] = useState<SceneArt | null>(null);
  const [active, setActive] = useState<string | null>(null); // the roving tab stop
  const [shown, setShown] = useState<string | null>(null); // the figure whose chip shows
  const group = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const els = useRef(new Map<string, HTMLButtonElement>());

  const placeChip = useCallback(() => {
    const c = chip.current;
    const el = shown ? els.current.get(shown) : undefined;
    if (!c || !el) return;
    const at = el.getBoundingClientRect();
    const [cx, cy] = [at.left + at.width / 2, at.top + at.height / 2];
    const [w, h] = [c.offsetWidth, c.offsetHeight];
    const avoid = [document.querySelector(`[data-hold="${hold}"] [data-panel]`), document.querySelector("nav[data-trail]")].map((e) => box(e?.getBoundingClientRect())).filter((b): b is Box => !!b);
    const [rx, ry] = [at.width / 2 + GAP, at.height / 2 + GAP];
    const spots: Box[] = [
      { x: cx - w / 2, y: cy - ry - h, w, h },
      { x: cx - w / 2, y: cy + ry, w, h },
      { x: cx + rx, y: cy - h / 2, w, h },
      { x: cx - rx - w, y: cy - h / 2, w, h },
    ];
    const inside = (b: Box) => b.x >= 4 && b.y >= 4 && b.x + b.w <= innerWidth - 4 && b.y + b.h <= innerHeight - 4;
    const clear = (b: Box) => inside(b) && !avoid.some((a) => meets(a, b));
    // above and below may slide sideways to fit the screen; the others stay beside the figure
    const slid = spots.map((b, i) => (i < 2 ? { ...b, x: Math.min(Math.max(b.x, 4), innerWidth - w - 4) } : b));
    const spot = slid.find(clear) ?? slid[0];
    c.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
  }, [hold, shown]);

  const place = useCallback(
    (st: Stage | null) => {
      const g = group.current;
      if (!g || !st || st.hold !== hold) return;
      const o = holdOpacity(st.holdT);
      const depth = tagDepth(st.art);
      g.style.opacity = String(o);
      g.dataset.on = String(o > 0.5); // a hold fading in or out takes no clicks, like its panel
      const panel = box(document.querySelector(`[data-hold="${hold}"] [data-panel]`)?.getBoundingClientRect());
      let under = false;
      for (const t of st.art.tags) {
        const el = els.current.get(t.id);
        if (!el) continue;
        // the box covers the figure's sprite (the tag point when the art has none), at least HIT square
        const sp = st.art.sprites.find((x) => x.id === t.id);
        const p = sp ? artToScreen({ x: sp.x + sp.w / 2, y: sp.y + sp.h / 2, depth: sp.depth }, st.art, st.cam, st.view, st.k, st.dpr) : artToScreen({ x: t.x, y: t.y, depth: t.depth ?? depth }, st.art, st.cam, st.view, st.k, st.dpr);
        const [w, h] = sp ? [Math.max(HIT, (sp.w * st.k) / st.dpr), Math.max(HIT, (sp.h * st.k) / st.dpr)] : [HIT, HIT];
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        if (panel && meets({ x: p.x, y: p.y, w: 1, h: 1 }, panel)) under = true; // the box's centre point
      }
      g.hidden = under; // a figure under the panel (a bottom sheet) has no name tag on this screen
      placeChip();
    },
    [hold, placeChip],
  );

  useEffect(() => {
    const on = (st: Stage | null) => {
      setArt(st && st.hold === hold ? st.art : null);
      place(st);
    };
    on(getStage());
    return subscribeStage(on);
  }, [hold, place]);
  useLayoutEffect(() => place(getStage()), [art, shown, place]);

  // Escape, or a tap elsewhere, puts the chip away.
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setShown(null);
    const away = (e: PointerEvent) => !(e.target as Element).closest(`[data-names="${section}"] button`) && setShown(null);
    addEventListener("keydown", key);
    addEventListener("pointerdown", away);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", away);
    };
  }, [shown, section]);

  const who = art?.tags.filter((t) => t.id.startsWith("who")) ?? [];
  if (!art || !who.length) return null;
  const idOf = (tag: string) => (tag === "who" ? FIGURES.find((f) => f.scene === section)!.id : tag.slice(4));
  const tab = who.some((t) => t.id === active) ? active : who[0].id;

  const move = (e: React.KeyboardEvent) => {
    const at = who.findIndex((t) => t.id === tab);
    const to = ({ ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: who.length - 1 } as Record<string, number>)[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const id = who[(to + who.length) % who.length].id;
    setActive(id);
    els.current.get(id)?.focus({ preventScroll: true });
  };

  return (
    <div ref={group} role="group" aria-label="The people in the scene" data-names={section} className={s.group} onKeyDown={move}>
      {who.map((t) => {
        const label = whoLabel(idOf(t.id));
        return (
          <button
            key={t.id}
            ref={(el) => void (el ? els.current.set(t.id, el) : els.current.delete(t.id))}
            type="button"
            className={s.hit}
            data-who={t.id}
            aria-label={label}
            tabIndex={t.id === tab ? 0 : -1}
            onFocus={() => { setActive(t.id); setShown(t.id); }}
            onBlur={() => setShown((p) => (p === t.id ? null : p))}
            onClick={() => setShown(t.id)}
            onPointerEnter={(e) => e.pointerType === "mouse" && setShown(t.id)}
            onPointerLeave={(e) => e.pointerType === "mouse" && document.activeElement !== e.currentTarget && setShown((p) => (p === t.id ? null : p))}
          />
        );
      })}
      {shown && (
        <span ref={chip} className={s.chip} data-name-chip="" aria-hidden="true">
          {whoLabel(idOf(shown))}
        </span>
      )}
    </div>
  );
}
