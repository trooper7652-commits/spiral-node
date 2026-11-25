type Pt = { x: number; y: number };
export type LabelItem = { id: string; at: Pt; text: string; anchor: Pt };

/** Estimated width of a label in px (20 px VT323 capitals with wide tracking). */
export const labelWidth = (text: string) => text.length * 13;

/** Places labels (x, y = top-left, px) at `at`, pushes crowded ones down, keeps each inside the box, and runs each leader line from the nearest label edge to its anchor. */
export function layoutLabels(items: LabelItem[], box: { w: number; h: number; labelH: number }) {
  const { w, h, labelH } = box;
  const placed = items
    .map((it) => {
      const lw = labelWidth(it.text);
      return { it, lw, x: it.at.x * w - lw / 2, y: it.at.y * h - labelH / 2 };
    })
    .sort((a, b) => a.y - b.y);
  placed.forEach((p, i) => {
    // earlier labels are already settled, and their y never exceeds this one's, so one pass down is enough
    for (let j = 0; j < i; j++) {
      const q = placed[j];
      if (p.x < q.x + q.lw && q.x < p.x + p.lw && p.y < q.y + labelH) p.y = q.y + labelH;
    }
  });
  return placed.map(({ it, lw, x: x0, y: y0 }) => {
    const x = Math.max(0, Math.min(x0, w - lw));
    const y = Math.max(0, Math.min(y0, h - labelH));
    const ax = it.anchor.x * w;
    const ay = it.anchor.y * h;
    const vertical = ay < y || ay > y + labelH; // anchor above or below: leave from the top or bottom edge
    const line = vertical
      ? { x1: Math.min(Math.max(ax, x), x + lw), y1: ay < y ? y : y + labelH, x2: ax, y2: ay }
      : { x1: ax < x ? x : x + lw, y1: y + labelH / 2, x2: ax, y2: ay };
    return { id: it.id, x, y, line };
  });
}
