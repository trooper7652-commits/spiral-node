import SignupForm from "./SignupForm";
import { SITE } from "@/lib/site";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={`${styles.footer} on-dark`}>
      <div className={styles.cols}>
        <div className={styles.signup}>
          <h2 className={styles.h}>Get Spiral Node updates</h2>
          {SITE.newsletterFormUrl ? (
            <SignupForm id="footer" />
          ) : (
            <p>Email updates are coming soon. Until then, star the repo to follow along.</p>
          )}
        </div>
        <nav aria-label="Footer" className={styles.links}>
          <a href={SITE.repoUrl}>GitHub</a>
          <a href={SITE.discussionsUrl}>Discussions</a>
          <a href="/contest">Script of the Month</a>
          <a href="/press">Press</a>
          <a href="/changelog">Changelog</a>
          <a href={`${SITE.repoUrl}/blob/main/LICENSES/README.md`}>Licences</a>
          <a href="/company">Company</a>
        </nav>
      </div>
      <p>Spiral Node is a prototype by Helix Velocities.</p>
      <p>The logo is a placeholder for now.</p>
    </footer>
  );
}
