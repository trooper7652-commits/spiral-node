import Reveal from "./Reveal";
import { FEATURES } from "@/lib/features";
import styles from "./FeatureGrid.module.css";

export default function FeatureGrid() {
  return (
    <ul className={styles.grid}>
      {FEATURES.map((f, i) => (
        <li key={f.id}>
          <Reveal delay={(i % 4) * 80}>
            <details className={`pixel-box ${styles.card}`} data-testid="feature">
              <summary>
                <img className={`pixelated ${styles.icon}`} src={`/art/icon-${f.id}.png`} width={48} height={48} alt="" />
                <span className={styles.title}>{f.title}</span>
                <span className={styles.line}>{f.line}</span>
              </summary>
              <p className={styles.detail}>{f.detail}</p>
            </details>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
