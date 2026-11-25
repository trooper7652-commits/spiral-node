import type { ReactNode } from "react";
import Panel from "./Panel";
import styles from "./Section.module.css";

export default function Section({ id, title, label, tone, children }: { id: string; title: string; label?: string; tone: "paper" | "cloud"; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className={`${styles.section} ${tone === "cloud" ? styles.cloud : ""}`}>
      <div className={styles.inner}>
        <Panel label={label ?? title}>
          <h2 id={`${id}-h`}>
            {title} {label && <span className="badge">{label}</span>}
          </h2>
          {children}
        </Panel>
      </div>
    </section>
  );
}
