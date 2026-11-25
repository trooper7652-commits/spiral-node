import type { Metadata } from "next";
import Page from "@/components/Page";
import { channels } from "@/lib/follow";
import { og } from "@/lib/meta";
import { SITE } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = og("company", "Visit us | Spiral Node", "Where to find Spiral Node.");

export default function FollowPage() {
  const list = channels();
  return (
    <Page band="square" title="Visit us">
      {list.length > 0 && (
        <>
          <h2>Channels</h2>
          <ul className={styles.cards}>
            {list.map((c) => (
              <li key={c.key} className={`pixel-box ${styles.card}`} data-testid="channel-card">
                <h3>{c.name}</h3>
                <p>{c.what}</p>
                <a className="btn" href={c.url}>Open {c.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Always here</h2>
      <ul>
        <li><a href={SITE.repoUrl}>The GitHub repo</a></li>
        <li><a href={SITE.discussionsUrl}>Discussions</a></li>
        <li><a href="/press">The press kit</a></li>
      </ul>
    </Page>
  );
}
