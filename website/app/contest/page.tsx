import { readFileSync } from "node:fs";
import { join } from "node:path";
import Page from "@/components/Page";
import { markdown } from "@/lib/devlog";
import { og } from "@/lib/meta";
import styles from "../devlog/devlog.module.css";

export const metadata = og("scripts", "Script of the Month | Spiral Node", "Script of the Month starts in January 2027. Write a script for a spotlight on this site and, when units exist, the first beta unit.");

// read at build time; the site builds from website/
const html = markdown(readFileSync(join(process.cwd(), "content/contest.md"), "utf8"));

export default function ContestPage() {
  return (
    <Page title="Script of the Month">
      {/* html comes from our own Markdown file, escaped by lib/devlog.ts */}
      <div className={styles.post} dangerouslySetInnerHTML={{ __html: html }} />
    </Page>
  );
}
