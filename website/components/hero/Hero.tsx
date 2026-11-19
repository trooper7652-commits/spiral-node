import HeroScenes from "./HeroScenes";
import HeroLive from "./HeroLive";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={`${styles.stage} on-dark`} aria-label="Spiral Node">
      <HeroScenes />
      <div className={styles.group}>
        <div className={styles.label}>
          <h1 className={styles.title}>Spiral Node</h1>
          <p className={styles.sub}>A pocket-size e-ink device that hands you keys to new thinking.</p>
        </div>
        <HeroLive />
      </div>
    </section>
  );
}
