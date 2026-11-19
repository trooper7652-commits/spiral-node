"use client";
import { useState } from "react";
import SimulatorLoader from "@/components/sim/SimulatorLoader";
import type { SimControl } from "@/components/sim/Simulator";
import { constant } from "@/lib/script-meta";
import { SITE } from "@/lib/site";
import { slugify, submitUrl } from "@/lib/submit";
import styles from "./Editor.module.css";

export default function Editor({ template }: { template: string }) {
  const [source, setSource] = useState(template);
  const [sim, setSim] = useState<SimControl | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const id = slugify(constant(source, "NAME") ?? "");
  const url = submitUrl(SITE.repoUrl, id, source);

  async function run() {
    if (!sim) return;
    setBusy(true);
    setError(await sim.run(id, source));
    setBusy(false);
  }
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([source], { type: "text/x-python" }));
    a.download = "script.py";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className={styles.editor}>
      <label htmlFor="script-source">Script source (Python)</label>
      <textarea id="script-source" className={styles.text} value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} />
      {error && (
        <pre role="alert" className={styles.error}>
          {error}
        </pre>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={run} disabled={!sim || busy}>
          Run
        </button>
        {url ? (
          <button type="button" className="btn" onClick={() => window.open(url, "_blank", "noopener")}>
            Submit to the gallery
          </button>
        ) : (
          <>
            <p aria-live="polite">This script is too long to submit from the browser. Download it and follow the contributing guide.</p>
            <button type="button" className="btn" onClick={download}>
              Download script.py
            </button>
            <a href={`${SITE.repoUrl}/blob/main/CONTRIBUTING.md`}>Contributing guide</a>
          </>
        )}
      </div>
      <div className={styles.sim}>
        <SimulatorLoader onControl={setSim} />
      </div>
    </div>
  );
}
