import StorySection from "@/components/story/StorySection";
import WriteOut from "@/components/world/WriteOut";
import styles from "./sections.module.css";

export default function ScenePurpose() {
  return (
    <StorySection id="s2" labelledBy="purpose-h" label="The idea">
      <h2 id="purpose-h">Something to think <span className={styles.accent}><WriteOut text="about." /></span></h2>
      <p className={styles.lede}>
        <strong>Spiral Node is a pocket e-ink device for people who like to think.</strong> It hands you one thing to think about at a time, then leaves the thinking to you. Offline and open source, made by Helix Velocities.
      </p>
    </StorySection>
  );
}
