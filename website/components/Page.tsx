import type { ReactNode } from "react";
import type { BandScene } from "../lib/world/band";
import PageBand from "./PageBand";
import Panel from "./Panel";
import styles from "./Page.module.css";

/** A plain content page: an optional pixel band, then one h1 and its content on a paper panel. */
export default function Page({ band, title, children }: { band?: BandScene; title: string; children: ReactNode }) {
  return (
    <>
      {band && <PageBand scene={band} />}
      <div className={styles.page} data-shell="">
        <Panel label={title}>
          <h1>{title}</h1>
          {children}
        </Panel>
      </div>
    </>
  );
}
