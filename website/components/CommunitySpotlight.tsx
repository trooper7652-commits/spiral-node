"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchStars } from "@/lib/github";
import { SITE } from "@/lib/site";
import styles from "./CommunitySpotlight.module.css";

const CONTRIBUTING = `${SITE.repoUrl}/blob/main/CONTRIBUTING.md`;
const GOOD_FIRST = `${SITE.repoUrl}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`;

/** Counts up to the target over ~1.2 s; reduced motion jumps straight to it. */
function useCountUp(target: number | null) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (target === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(target);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1200);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

export default function CommunitySpotlight() {
  const [stars, setStars] = useState<number | null | undefined>(undefined); // undefined while loading
  useEffect(() => {
    let live = true;
    fetchStars(SITE.repoApi).then((s) => live && setStars(s));
    return () => {
      live = false;
    };
  }, []);
  const shown = useCountUp(stars ?? null);

  return (
    <div className={styles.spotlight} data-testid="community">
      <div className={`pixel-box ${styles.stars}`}>
        {stars === undefined ? (
          <p className={styles.big}>Counting stars&hellip;</p>
        ) : stars === null ? (
          <p className={styles.big}>Be one of the first to star Spiral Node</p>
        ) : (
          <p className={styles.big}>
            <span data-testid="star-count">{shown.toLocaleString("en")}</span> {stars === 1 ? "star" : "stars"} on GitHub
          </p>
        )}
        <a className="btn" href={SITE.repoUrl} target="_blank" rel="noopener">
          Star on GitHub
        </a>
      </div>

      <div className={styles.people}>
        <h3>Contributors</h3>
        <p>
          <a href={`${SITE.repoUrl}/graphs/contributors`}>See everyone who has contributed</a>, or be next: <a href={CONTRIBUTING}>write a script</a>
        </p>
      </div>

      <ul className={styles.links}>
        <li>
          <a className="btn" href={CONTRIBUTING}>
            Write a script
          </a>
        </li>
        <li>
          <a href={GOOD_FIRST}>Good first issues</a>
        </li>
        <li>
          <a href={SITE.discussionsUrl}>Discussions</a>
        </li>
      </ul>

      <div className={`pixel-box ${styles.featured}`}>
        <h3>Featured script: Connect</h3>
        <p>Two random topics from different categories, and one question: what links these? Community scripts will be featured here.</p>
        <Link href="/try?script=connect">Run it in the simulator</Link>
      </div>
    </div>
  );
}
