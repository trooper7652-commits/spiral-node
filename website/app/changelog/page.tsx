import { readFileSync } from "node:fs";
import { join } from "node:path";
import Page from "@/components/Page";
import { markdown } from "@/lib/devlog";
import { og } from "@/lib/meta";
import styles from "../devlog/devlog.module.css";

export const metadata = og("devlog", "Changelog | Spiral Node", "What changed in each version of Spiral Node.");

// read at build time from the repo root (../CHANGELOG.md); the site builds from website/
const src = readFileSync(join(process.cwd(), "../CHANGELOG.md"), "utf8").replace(/^# Changelog\n/, "");
const html = markdown(src);

export default function ChangelogPage() {
  return (
    <Page band="map" title="Changelog">
      {/* html comes from our own Markdown file, escaped by lib/devlog.ts */}
      <div className={styles.post} dangerouslySetInnerHTML={{ __html: html }} />
    </Page>
  );
}
