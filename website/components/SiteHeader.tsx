import Link from "next/link";
import { SITE } from "@/lib/site";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={`${styles.header} on-dark`}>
      <Link href="/" className={styles.wordmark}>Spiral Node</Link>
      <nav aria-label="Main" className={styles.nav}>
        <Link href="/">Product</Link>
        <Link href="/scripts">Scripts</Link>
        <Link href="/today">Today</Link>
        <Link href="/#community">Community</Link>
        <Link href="/devlog">Devlog</Link>
        <Link href="/build-log">Build log</Link>
        <a href={SITE.repoUrl} aria-label="Star Spiral Node on GitHub">&#9733; GitHub</a>
        <Link href="/try" className={styles.cta}>Try the demo</Link>
      </nav>
    </header>
  );
}
