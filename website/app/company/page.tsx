import type { Metadata } from "next";
import { og } from "@/lib/meta";
import styles from "./page.module.css";

export const metadata: Metadata = og("company", "Company | Spiral Node", "Helix Velocities makes Spiral Node, its first product.");

export default function CompanyPage() {
  return (
    <div className={styles.page}>
      <h1>Helix Velocities</h1>
      <div className={styles.row}>
        {/* Helix the snail, 10x8 art px at a whole-number 6x */}
        <img className="pixelated" src="/art/snail.png" width={60} height={48} alt="Helix, the pixel-art snail mascot." />
        <p>Helix Velocities makes tools for human thinking.</p>
        <p>Helix Velocities (&lsquo;Helix&rsquo;) makes Spiral Node, its first product.</p>
      </div>
      <blockquote className={`pixel-box ${styles.quote}`}>
        A key to ingenuity for visionaries, artisans, crafters, makers, doers, designers, innovators, operators
      </blockquote>
      <p>Our mascot is a snail: its spiral shell is the theme of Spiral Node, right down to the spiral boot animation.</p>
      <h2>Core values</h2>
      <ul className={styles.values}>
        <li className="pixel-box">Creativity</li>
        <li className="pixel-box">Inventiveness</li>
      </ul>
    </div>
  );
}
