import HangingSigns from "./HangingSigns";
import StorySection from "@/components/story/StorySection";
import LaunchButtons from "@/components/LaunchButtons";
import styles from "./sections.module.css";

const PATHS = [
  { href: "/spiral-node", title: "The device", line: "What it is, what it is made of, and the launch list." },
  { href: "/scripts", title: "Scripts", line: "Small loops, one thought at a time." },
  { href: "/today", title: "Today", line: "Today's fact and question." },
  { href: "/write", title: "Write your own", line: "Write your own script." },
  { href: "/design", title: "Design explorations", line: "Shapes and colours being tried." },
] as const;

export default function SceneExplore() {
  return (
    <StorySection id="s9" labelledBy="explore-h" label="Explore">
      <h2 id="explore-h">Choose your <span className={styles.accent}>path</span></h2>
      <HangingSigns paths={PATHS} />
      <p className={styles.want}>Want one?</p>
      <LaunchButtons />
    </StorySection>
  );
}
