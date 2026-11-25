import StorySection from "@/components/story/StorySection";
import Link from "next/link";
import ScriptCards from "@/components/ScriptCards";
import { listScripts } from "@/lib/scripts";
import { scriptSamples } from "@/lib/scriptSamples";
import ScriptScreens from "./ScriptScreens";
import styles from "./sections.module.css";

export default function SceneScripts() {
  return (
    <StorySection
      id="s5"
      labelledBy="scripts-h"
      label="Scripts"
      more={
        <>
          <p>How it works: the loop picks something, shows it on the e-ink screen, waits 15, 30 or 60 seconds, then shows the next. You can run any of them right now in the simulator.</p>
          <ScriptCards scripts={listScripts().slice(0, 3)} />
        </>
      }
    >
      <h2 id="scripts-h">Small <span className={styles.accent}>scripts</span></h2>
      <p className={styles.lede}>A script is a small Python loop that shows one thing at a time: a fact, a question, a puzzle or a line of a poem.</p>
      <ScriptScreens samples={scriptSamples()} />
      <p><Link href="/scripts">See more scripts</Link></p>
    </StorySection>
  );
}
