"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRepoStats, type RepoStats } from "@/lib/github";
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

const sized = (avatar: string) => `${avatar}${avatar.includes("?") ? "&" : "?"}s=96`;

export default function CommunitySpotlight() {
  const [stats, setStats] = useState<RepoStats | null>(null); // null while loading
  useEffect(() => {
    let live = true;
    fetchRepoStats(SITE.repoApi).then((s) => live && setStats(s));
    return () => {
      live = false;
    };
  }, []);
  const stars = useCountUp(stats?.stars ?? null);

  return (
    <div className={styles.spotlight} data-testid="community">
      <div className={`pixel-box ${styles.stars}`}>
        {stats === null ? (
          <p className={styles.big}>Counting stars&hellip;</p>
        ) : stats.stars === null ? (
          <p className={styles.big}>Be one of the first to star Spiral Node</p>
        ) : (
          <p className={styles.big}>
            <span data-testid="star-count">{stars.toLocaleString("en")}</span> {stats.stars === 1 ? "star" : "stars"} on GitHub
          </p>
        )}
        <a className="btn" href={SITE.repoUrl} target="_blank" rel="noopener">
          Star on GitHub
        </a>
      </div>

      <div className={styles.people}>
        <h3>Contributors</h3>
        {stats === null ? (
          <p>Loading contributors&hellip;</p>
        ) : stats.contributors.length === 0 ? (
          <p>
            Be the first contributor: <a href={CONTRIBUTING}>write a script</a>
          </p>
        ) : (
          <ul className={styles.wall}>
            {stats.contributors.map((c, i) => (
              <li key={c.login} style={{ animationDelay: `${Math.min(i, 20) * 60}ms` }}>
                <a href={c.url} target="_blank" rel="noopener" title={c.login}>
                  <img src={sized(c.avatar)} width={48} height={48} alt={c.login} loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        )}
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
