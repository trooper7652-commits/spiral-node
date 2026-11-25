import Link from "next/link";
import { NAV } from "@/lib/nav";
import LaunchListButton from "./LaunchListButton";
import MenuToggle from "./MenuToggle";
import StoryHeaderState from "./story/StoryHeaderState";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <StoryHeaderState>
      <header className={`${styles.header} on-dark`}>
        <Link href="/" className={styles.wordmark}>Spiral Node</Link>
        {/* phone copy in the top row; the nav's last link is the one shown at 760 px and up */}
        <Link href="/try" className={`${styles.cta} ${styles.ctaTop}`}>Try the demo</Link>
        <MenuToggle>
          <nav id="site-nav" aria-label="Main" className={styles.nav}>
            {NAV.map((n, i) => {
              const inner = (
                <>
                  <span className={styles.label}>{n.label}</span>
                  <span className={`${styles.card} ${i >= NAV.length - 2 ? styles.cardEnd : ""}`} aria-hidden="true">
                    <span className={styles.emblem} data-emblem="">{n.label.replace("★ ", "").charAt(0)}</span>
                    <span id={`nav-hook-${i}`} className={styles.hook}>{n.hook}</span>
                  </span>
                </>
              );
              return n.href.startsWith("http") ? (
                <a key={n.href} href={n.href} aria-label={n.ariaLabel} aria-describedby={`nav-hook-${i}`}>{inner}</a>
              ) : (
                <Link key={n.href} href={n.href} aria-label={n.ariaLabel} aria-describedby={`nav-hook-${i}`}>{inner}</Link>
              );
            })}
            <LaunchListButton />
            <Link href="/try" className={styles.cta}>Try the demo</Link>
          </nav>
        </MenuToggle>
      </header>
    </StoryHeaderState>
  );
}
