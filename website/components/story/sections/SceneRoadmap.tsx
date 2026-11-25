import StorySection from "@/components/story/StorySection";
import Link from "next/link";
import { ROADMAP } from "@/lib/content";
import { listPosts } from "@/lib/devlog";
import styles from "./sections.module.css";

export default function SceneRoadmap() {
  const latest = listPosts()[0];
  return (
    <StorySection
      id="s6"
      labelledBy="roadmap-h"
      label="Progress"
      more={
        <div data-testid="roadmap">
          <h3 className={styles.sub}>Roadmap</h3>
          <ol className={styles.roadmap}>
            {ROADMAP.map((r) => (
              <li key={r.text}>
                <span className={styles.mark} aria-hidden="true">{r.done ? "✓" : "·"}</span>
                <span className={styles.sr}>{r.done ? "Done: " : "Next: "}</span>
                {r.href ? <Link href={r.href}>{r.text}</Link> : r.text}
              </li>
            ))}
          </ol>
        </div>
      }
    >
      <h2 id="roadmap-h">Roadmap and <span className={styles.accent}>devlog</span></h2>
      <div data-testid="latest-post">
        <h3 className={styles.sub}>Latest from the devlog</h3>
        <p className={styles.post}><Link href={`/devlog/${latest.slug}`}>{latest.title}</Link></p>
        <p><time dateTime={latest.date}>{latest.date}</time></p>
        <p className={styles.opt}>{latest.summary}</p>
        <p><Link href="/devlog">All devlog entries</Link></p>
      </div>
    </StorySection>
  );
}
