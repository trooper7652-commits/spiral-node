import StorySection from "@/components/story/StorySection";
import FeatureEmblems from "./FeatureEmblems";
import styles from "./sections.module.css";

export default function SceneFeatures() {
  return (
    <StorySection id="s3" labelledBy="features-h" label="Design" more={<FeatureEmblems />}>
      <h2 id="features-h">Design <span className={styles.accent}>features</span></h2>
      <p>Eight choices behind the device. Open one to read why.</p>
    </StorySection>
  );
}
