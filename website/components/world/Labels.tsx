"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { layoutLabels, type LabelItem } from "../../lib/world/labels";
import s from "./holds.module.css";

const BOX = { w: 600, h: 360, labelH: 24 };

/** Leader-line labels in a box that keeps its aspect (default 600 x 360, at most that wide). Fractions in; labels are laid out at the box's real width and placed in percent. */
export default function Labels({ items, box = BOX, render }: { items: LabelItem[]; box?: typeof BOX; render?: (id: string) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(box.w);
  useEffect(() => {
    const el = root.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || box.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.w]);

  const w = width;
  const h = (width * box.h) / box.w;
  const out = layoutLabels(items, { w, h, labelH: box.labelH });
  return (
    <div ref={root} className={s.labels} style={{ maxWidth: box.w, aspectRatio: `${box.w} / ${box.h}` }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        {out.map(({ id, line }) => (
          <g key={id}>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="currentColor" strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
            <circle cx={line.x2} cy={line.y2} r={3.5} fill="currentColor" />
          </g>
        ))}
      </svg>
      {out.map(({ id, x, y }) => (
        <span key={id} className={s.labelText} style={{ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%`, height: box.labelH }}>
          {render ? render(id) : items.find((i) => i.id === id)!.text}
        </span>
      ))}
    </div>
  );
}
