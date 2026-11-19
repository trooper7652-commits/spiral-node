import Link from "next/link";
import Page from "@/components/Page";
import { listPosts } from "@/lib/devlog";
import { og } from "@/lib/meta";
import styles from "./devlog.module.css";

export const metadata = og("devlog", "Devlog | Spiral Node", "Notes from building Spiral Node, about once a week.");

export default function DevlogPage() {
  return (
    <Page title="Devlog">
      <p>Notes from building Spiral Node, about once a week.</p>
      <ul className={styles.list}>
        {listPosts().map((p) => (
          <li key={p.slug} className={styles.item}>
            <h2 className={styles.title}>
              <Link href={`/devlog/${p.slug}`}>{p.title}</Link>
            </h2>
            <p className={styles.date}>
              <time dateTime={p.date}>{p.date}</time>
            </p>
            <p>{p.summary}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
