import { notFound } from "next/navigation";
import Page from "@/components/Page";
import { listPosts } from "@/lib/devlog";
import { og } from "@/lib/meta";
import styles from "../devlog.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return listPosts().map((p) => ({ slug: p.slug }));
}

const find = (slug: string) => listPosts().find((p) => p.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = find((await params).slug);
  return p ? og("devlog", `${p.title} | Spiral Node`, p.summary) : {};
}

export default async function DevlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const p = find((await params).slug);
  if (!p) notFound();
  return (
    <Page title={p.title}>
      <p className={styles.date}>
        <time dateTime={p.date}>{p.date}</time>
      </p>
      {/* html comes from our own Markdown files, escaped by lib/devlog.ts */}
      <div className={styles.post} dangerouslySetInnerHTML={{ __html: p.html }} />
    </Page>
  );
}
