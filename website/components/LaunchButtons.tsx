import { SITE } from "@/lib/site";
import styles from "./LaunchButtons.module.css";

export default function LaunchButtons() {
  return (
    <div className={styles.row}>
      <a className="btn" href="/spiral-node#get-updates-h">Join the launch list</a>
      <a className="btn btn-secondary" href={SITE.repoUrl}>★ Star on GitHub</a>
    </div>
  );
}
