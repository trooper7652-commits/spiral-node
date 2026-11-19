import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Page from "@/components/Page";
import Editor from "@/components/write/Editor";
import { og } from "@/lib/meta";

export const metadata: Metadata = og("scripts", "Write a script | Spiral Node", "Write a Spiral Node script in your browser, run it in the simulator, then send it to the gallery.");

export default function WritePage() {
  const template = readFileSync(join(process.cwd(), "../scripts/TEMPLATE/script.py"), "utf8"); // read at build time
  return (
    <Page title="Write a script">
      <p>Edit the template, press Run to see it on the simulator, then submit it to the gallery as a pull request.</p>
      <Editor template={template} />
    </Page>
  );
}
