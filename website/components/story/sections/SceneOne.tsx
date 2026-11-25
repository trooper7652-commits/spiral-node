import StorySection from "@/components/story/StorySection";
import styles from "./sections.module.css";

export default function SceneOne() {
  return (
    <StorySection id="s1" labelledBy="home-h" label="Helix Velocities">
      <h1 id="home-h">Spiral <span className={styles.accent}>Node</span></h1>
      <p className={styles.lede}>A pocket-size e-ink device that hands you keys to new thinking.</p>
    </StorySection>
  );
}
