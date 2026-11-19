import type { Metadata } from "next";
import SimulatorLoader from "@/components/sim/SimulatorLoader";
import { og } from "@/lib/meta";
import styles from "./page.module.css";

export const metadata: Metadata = og("try", "Try Spiral Node | Spiral Node", "The real Spiral OS, running in your browser. Nothing to install, nothing to sign up for.");

export default function TryPage() {
  return (
    <div className={styles.page}>
      <h1>Try Spiral Node</h1>
      <p>This is the real Spiral OS, running in your browser. It saves to this browser only.</p>
      <SimulatorLoader />
    </div>
  );
}
