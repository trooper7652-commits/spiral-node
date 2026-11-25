"use client";

import styles from "./SiteHeader.module.css";

/** Opens the welcome popup from anywhere: WelcomePopup listens for sn:open-welcome. */
export default function LaunchListButton() {
  return (
    <button type="button" className={styles.launch} data-testid="launch-list" onClick={() => window.dispatchEvent(new Event("sn:open-welcome"))}>
      Join the launch list
    </button>
  );
}
