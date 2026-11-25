"use client";

import { useContext } from "react";
import { HoldFrame } from "@/components/world/Holds";
import { FAQ } from "@/lib/content";
import styles from "./FloatingQuestions.module.css";

/** The twelve questions along one thin line. While the hold is shown, hold progress picks the large one; the rest stay small and keep their answers for screen readers. */
export default function FloatingQuestions() {
  const frame = useContext(HoldFrame);
  // -1: no frame yet (or no script): every question shows with its answer, in flow
  const step = frame ? (frame.hold === "s7-hold" ? Math.min(FAQ.length - 1, Math.max(0, Math.floor((frame.holdT ?? 0) * FAQ.length))) : 0) : -1;
  return (
    <ul className={styles.line} data-step={step}>
      {FAQ.map((f, i) => (
        <li key={f.q} className={styles.q} data-testid="question" data-current={i === step ? "true" : undefined}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </li>
      ))}
    </ul>
  );
}
