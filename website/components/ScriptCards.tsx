import Link from "next/link";
import type { ScriptCard } from "@/lib/scripts";
import styles from "./ScriptCards.module.css";

export default function ScriptCards({ scripts }: { scripts: ScriptCard[] }) {
  return (
    <ul className={styles.cards}>
      {scripts.map((s) => (
        <li key={s.id} className={`pixel-box ${styles.card}`} data-testid="script-card">
          <h3 className={styles.name}>
            <Link href={`/scripts/${s.id}`}>{s.name}</Link>
          </h3>
          <p>{s.description}</p>
          <p className={styles.by}>
            by {s.community ? <a href={`https://github.com/${encodeURIComponent(s.author)}`}>{s.author}</a> : s.author}
          </p>
          <Link className="btn" href={`/try?script=${s.id}`}>
            Run in simulator
          </Link>
        </li>
      ))}
    </ul>
  );
}
