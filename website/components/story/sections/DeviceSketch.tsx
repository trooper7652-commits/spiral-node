"use client";

import art from "@/public/art/device.json";
import Labels from "@/components/world/Labels";
import { LABELS, SKETCH } from "@/lib/story/labels";
import styles from "./DeviceSketch.module.css";

const T = SKETCH.top;
const F = SKETCH.front;
const centred = (x: number, w: number) => x - w / 2;
const ITEMS = LABELS.map((l) => ({ id: l.part, text: l.part, at: { x: l.lx, y: l.ly }, anchor: { x: l.x, y: l.y } }));

export default function DeviceSketch() {
  return (
    <figure className={styles.sketch}>
      <div className={styles.board}>
        <svg viewBox={`0 0 ${SKETCH.w} ${SKETCH.h}`} className={styles.ink} aria-hidden="true" focusable="false">
          <rect x={T.x} y={T.y} width={art.top.width} height={art.top.height} rx={18} />
          {art.top.usb.map((u) => (
            <rect key={u.x} x={T.x + centred(u.x, u.w)} y={T.y + centred(u.y, u.h)} width={u.w} height={u.h} rx={4} />
          ))}
          <circle cx={T.x + art.top.light.x} cy={T.y + art.top.light.y} r={art.top.light.r} />
          <rect x={T.x + centred(art.top.power.x, art.top.power.w)} y={T.y + centred(art.top.power.y, art.top.power.h)} width={art.top.power.w} height={art.top.power.h} rx={3} />
          <rect x={F.x} y={F.y} width={art.width} height={art.height} rx={28} />
          <rect x={F.x + art.screen.x} y={F.y + art.screen.y} width={art.screen.w} height={art.screen.h} rx={4} />
          <rect x={F.x + art.keys.back.x} y={F.y + art.keys.back.y} width={art.keys.back.w} height={art.keys.back.h} rx={6} />
          <rect x={F.x + art.keys.home.x} y={F.y + art.keys.home.y} width={art.keys.home.w} height={art.keys.home.h} rx={6} />
          <circle cx={F.x + art.logo.cx} cy={F.y + art.logo.cy} r={art.logo.r} />
          <circle cx={F.x + art.wheel.cx} cy={F.y + art.wheel.cy} r={art.wheel.r} />
          <circle cx={F.x + art.wheel.cx} cy={F.y + art.wheel.cy} r={art.wheel.centerR} />
        </svg>
        <div className={styles.labels}>
          <Labels items={ITEMS} box={{ w: SKETCH.w, h: SKETCH.h, labelH: 24 }} render={(id) => <span data-testid="part-label">{id}</span>} />
        </div>
      </div>
      <figcaption className={styles.caption}>Prototype design, may change.</figcaption>
    </figure>
  );
}
