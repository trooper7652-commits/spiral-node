import type { Stage } from "@/lib/sim/protocol";
import styles from "./Sim.module.css";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "runtime", label: "Loading Python" },
  { id: "pillow", label: "Loading Pillow" },
  { id: "os", label: "Unpacking Spiral OS" },
  { id: "storage", label: "Opening storage" },
  { id: "boot", label: "Booting" },
];
const CELLS = 20;

/** E-ink style progress on the screen area: stage names and a pixel bar. Never blank. */
export function ProgressPanel({ stage }: { stage: Stage }) {
  const at = STAGES.findIndex((s) => s.id === stage);
  const filled = Math.round(((at + 0.5) / STAGES.length) * CELLS);
  return (
    <div className={styles.panel} role="status" aria-label={`Starting: ${STAGES[at].label}`}>
      <p className={styles.panelTitle}>Spiral Node</p>
      <ul className={styles.stages}>
        {STAGES.map((s, i) => (
          <li key={s.id} data-state={i < at ? "done" : i === at ? "now" : "todo"}>
            <span aria-hidden="true">{i < at ? "x" : i === at ? ">" : "-"}</span> {s.label}
          </li>
        ))}
      </ul>
      <div className={styles.bar} aria-hidden="true">
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} data-on={i < filled ? "" : undefined} />
        ))}
      </div>
    </div>
  );
}

/** Device-style error panel with Try again. */
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.panel} role="alert">
      <p className={styles.panelTitle}>Spiral Node</p>
      <p className={styles.errorText}>{message}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
