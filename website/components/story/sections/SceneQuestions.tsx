import StorySection from "@/components/story/StorySection";
import FloatingQuestions from "./FloatingQuestions";
import styles from "./sections.module.css";

export default function SceneQuestions() {
  return (
    <StorySection id="s7" labelledBy="faq-h" label="Questions">
      <h2 id="faq-h">Questions, <span className={styles.accent}>answered</span></h2>
      <FloatingQuestions />
    </StorySection>
  );
}
