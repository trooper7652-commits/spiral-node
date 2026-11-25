import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Page from "@/components/Page";
import { markdown } from "@/lib/devlog";
import { og } from "@/lib/meta";
import styles from "../devlog/devlog.module.css";

// Not linked yet: waiting on the owner's first name and photo (owner-answers.md).
export const metadata: Metadata = {
  ...og("company", "Why I started Spiral Node | Spiral Node", "The founder of Helix Velocities on why Spiral Node exists."),
  robots: { index: false },
};

// read at build time; the site builds from website/
const html = markdown(readFileSync(join(process.cwd(), "content/founder.md"), "utf8"));

export default function FounderPage() {
  return (
    <Page band="countryside" title="Why I started Spiral Node">
      {/* html comes from our own Markdown file, escaped by lib/devlog.ts */}
      <div className={styles.post} dangerouslySetInnerHTML={{ __html: html }} />
    </Page>
  );
}
