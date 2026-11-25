"use client";

import { useState } from "react";
import Labels from "@/components/world/Labels";
import { FEATURES } from "@/lib/features";
import styles from "./FeatureEmblems.module.css";

// Two columns of labels, left and right, with their leader lines reaching in towards the desk's objects.
const ITEMS = FEATURES.map((f, i) => {
  const right = i % 2 === 1;
  const row = Math.floor(i / 2);
  return { id: f.id, text: f.title, at: { x: right ? 0.87 : 0.13, y: 0.12 + row * 0.25 }, anchor: { x: right ? 0.62 : 0.38, y: 0.2 + row * 0.2 } };
});

export default function FeatureEmblems() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <>
      <Labels
        items={ITEMS}
        render={(id) => (
          <span data-testid="feature">
            <button
              type="button"
              aria-expanded={!!open[id]}
              aria-controls={`feature-${id}`}
              onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
            >
              {FEATURES.find((f) => f.id === id)!.title}
            </button>
          </span>
        )}
      />
      {FEATURES.map((f) => (
        <div key={f.id} id={`feature-${f.id}`} className={styles.body} hidden={!open[f.id]}>
          <p className={styles.line}>{f.line}</p>
          <p className={styles.detail}>{f.detail}</p>
        </div>
      ))}
    </>
  );
}
