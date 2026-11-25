import type { Metadata } from "next";
import Page from "@/components/Page";
import ScriptCards from "@/components/ScriptCards";
import { og } from "@/lib/meta";
import { listScripts } from "@/lib/scripts";
import { SITE } from "@/lib/site";

export const metadata: Metadata = og("scripts", "Scripts | Spiral Node", "Small Python loops that show something to think about. Run any of them in your browser.");

export default function ScriptsPage() {
  return (
    <Page band="scroll" title="Scripts">
      <p>Scripts are small Python loops that show something to think about. Run any of them in the simulator, or write your own.</p>
      <ScriptCards scripts={listScripts()} />
      <h2>Write a script</h2>
      <p>
        <a href="/write">Write your own</a> in the browser, or copy the template, add your library of facts, stories or topics, and open a pull request. The{" "}
        <a href={`${SITE.repoUrl}/blob/main/CONTRIBUTING.md`}>contributing guide</a> walks you through it.
      </p>
    </Page>
  );
}
