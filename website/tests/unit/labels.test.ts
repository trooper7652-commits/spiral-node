import { describe, expect, it } from "vitest";
import { LABELS, SKETCH } from "../../lib/story/labels";
import { labelWidth, layoutLabels } from "../../lib/world/labels";

const box = { w: 600, h: 360, labelH: 24 };

describe("layoutLabels", () => {
  it("labels never overlap and leader lines end on their anchor and start on their label's edge", () => {
    const items = [0.5, 0.52, 0.54, 0.56, 0.58].map((y, i) => ({
      id: "l" + i,
      at: { x: 0.5, y },
      text: "Label " + i,
      anchor: { x: 0.1 + i * 0.15, y: 0.9 },
    }));
    const out = layoutLabels(items, box);
    expect(out).toHaveLength(5);
    const item = (id: string) => items.find((i) => i.id === id)!;
    const boxes = out.map((o) => ({ x: o.x, y: o.y, w: labelWidth(item(o.id).text), h: box.labelH }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
    out.forEach((o) => {
      const it = item(o.id);
      const lw = labelWidth(it.text);
      const { x1, y1, x2, y2 } = o.line;
      expect(x2).toBeCloseTo(it.anchor.x * box.w);
      expect(y2).toBeCloseTo(it.anchor.y * box.h);
      const onSide = (x1 === o.x || x1 === o.x + lw) && y1 >= o.y && y1 <= o.y + box.labelH;
      const onEdge = (y1 === o.y || y1 === o.y + box.labelH) && x1 >= o.x && x1 <= o.x + lw;
      expect(onSide || onEdge, o.id + " line starts on its label").toBe(true);
    });
  });

  it("a label near the right or bottom edge stays inside the box", () => {
    const out = layoutLabels(
      [
        { id: "right", at: { x: 0.99, y: 0.5 }, text: "Spiral wheel", anchor: { x: 0.5, y: 0.5 } },
        { id: "bottom", at: { x: 0.5, y: 0.99 }, text: "Back", anchor: { x: 0.5, y: 0.2 } },
        { id: "corner", at: { x: 0, y: 0 }, text: "Home", anchor: { x: 0.5, y: 0.5 } },
      ],
      box,
    );
    for (const o of out) {
      const lw = labelWidth({ right: "Spiral wheel", bottom: "Back", corner: "Home" }[o.id]!);
      expect(o.x, o.id + " left").toBeGreaterThanOrEqual(0);
      expect(o.x + lw, o.id + " right").toBeLessThanOrEqual(box.w);
      expect(o.y, o.id + " top").toBeGreaterThanOrEqual(0);
      expect(o.y + box.labelH, o.id + " bottom").toBeLessThanOrEqual(box.h);
    }
  });
});

describe("scene 4's sketch labels", () => {
  it("name the USB-C as on the top, and point it at the top face drawn above the front", () => {
    expect(LABELS.map((l) => l.part)).toEqual(["Screen", "USB-C top", "Back", "Home", "Spiral wheel"]);
    const usb = LABELS.find((l) => l.part === "USB-C top")!;
    expect(usb.y * SKETCH.h).toBeLessThan(SKETCH.front.y); // on the top face, which sits above the front
    for (const l of LABELS) for (const v of [l.x, l.y, l.lx, l.ly]) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
  });
});
