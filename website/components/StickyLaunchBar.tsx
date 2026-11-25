"use client";

import { useEffect, useState } from "react";
import styles from "./StickyLaunchBar.module.css";

// Phone-only bar: shown while neither the hero buttons nor the sign-up section are on screen.
export default function StickyLaunchBar({ ctaId, signupId }: { ctaId: string; signupId: string }) {
  const [seen, setSeen] = useState({ cta: true, signup: false, footer: false });

  useEffect(() => {
    // the whole sign-up section (not just its heading) and the footer also hide the bar
    const watched = [
      ["cta", document.getElementById(ctaId)],
      ["signup", document.getElementById(signupId)?.closest("section") ?? null],
      ["footer", document.querySelector("footer")],
    ] as const;
    const io = new IntersectionObserver((entries) => {
      setSeen((prev) => {
        const next = { ...prev };
        for (const e of entries) for (const [k, el] of watched) if (el === e.target) next[k] = e.isIntersecting;
        return next;
      });
    });
    for (const [, el] of watched) if (el) io.observe(el);
    return () => io.disconnect();
  }, [ctaId, signupId]);

  const show = !seen.cta && !seen.signup && !seen.footer;
  return (
    <div className={styles.bar} data-testid="sticky-launch-bar" data-show={show} hidden={!show}>
      <a className="btn" href="/spiral-node#get-updates-h">Join the launch list</a>
    </div>
  );
}
