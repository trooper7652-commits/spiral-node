import type { ReactNode } from "react";
import styles from "./Page.module.css";

/** A plain content page: one h1 and a readable column. */
export default function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
