import Link from "next/link";
import Section from "./Section";
import styles from "./ExploreRow.module.css";

const CARDS = [
  { img: "nautilus", href: "/scripts", text: "Small scripts, one thought at a time" },
  { img: "compass", href: "/today", text: "Today's fact and question" },
  { img: "quill", href: "/write", text: "Write your own script" },
  { img: "apple", href: "/design", text: "Design explorations" },
] as const;

export default function ExploreRow() {
  return (
    <Section id="explore" title="Explore" tone="paper">
      <ul className={styles.row}>
        {CARDS.map((c) => (
          <li key={c.href} className={styles.card} data-testid="explore-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`pixelated ${styles.art}`} src={`/art/explore-${c.img}.png`} width={72} height={72} alt="" />
            <Link href={c.href}>{c.text} →</Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
