"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import SignupForm from "./SignupForm";
import { fetchRepoStats } from "@/lib/github";
import { readState, shouldShow, writeState } from "@/lib/popup";
import { SITE } from "@/lib/site";
import styles from "./SignupPopup.module.css";

const PHONE = "(max-width: 639px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const CELLS = Array.from({ length: 48 }, (_, i) => ((i * 7) % 12) * 50); // 12x4 pixel blocks, 12 stepped waves of 50 ms

export default function SignupPopup() {
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [fake, setFake] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<"still" | "out" | "in" | "fade">("still");
  const [stars, setStars] = useState<number | null>(null);

  // counts visible-tab time only; checks the rules every second until it shows once
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("popup") === "now";
    setFake(forced && !SITE.newsletterFormUrl);
    let visibleMs = 0;
    let shown = false;
    const check = () => {
      if (shown) return;
      const s = readState();
      const demoRunning = document.documentElement.dataset.demo === "running";
      if (shouldShow({ ...s, now: Date.now(), visibleMs, path: location.pathname, demoRunning, forced, formUrl: SITE.newsletterFormUrl })) {
        shown = true;
        writeState({ dismissedAt: Date.now() }); // seen counts as dismissed: once per 30 days, once per page view without storage
        setOpen(true);
      }
    };
    check();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") visibleMs += 1000;
      check();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (path.startsWith("/try")) setOpen(false);
  }, [path]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (matchMedia(PHONE).matches) d.show();
      else d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function done() {
    fetchRepoStats(SITE.repoApi).then((s) => setStars(s.stars));
    if (matchMedia(REDUCED).matches) {
      setPhase("fade");
      setTimeout(() => {
        setStep(2);
        setPhase("still");
      }, 100);
      return;
    }
    setPhase("out");
    setTimeout(() => {
      setStep(2);
      setPhase("in");
      setTimeout(() => setPhase("still"), 650);
    }, 650);
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="signup-title"
      data-testid="signup-popup"
      onClose={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div className={styles.inner}>
        <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
          &times;
        </button>
        <div className={styles.body} data-phase={phase}>
          {step === 1 ? (
            <>
              <h2 id="signup-title" className={styles.title}>Get Spiral Node updates</h2>
              <p>A short note when something real happens. Unsubscribe anytime.</p>
              <SignupForm id="popup" onDone={done} fake={fake} />
            </>
          ) : (
            <>
              <h2 id="signup-title" className={styles.title}>Thanks! Check your inbox to confirm.</h2>
              <p>One more thing: star Spiral Node on GitHub.</p>
              <div className={styles.row}>
                <a className="btn" href={SITE.repoUrl} target="_blank" rel="noopener">
                  Star on GitHub
                </a>
                {stars !== null && <span>{stars.toLocaleString("en")} {stars === 1 ? "star" : "stars"}</span>}
                <a href={`${SITE.repoUrl}/blob/main/CONTRIBUTING.md`}>or write a script</a>
              </div>
            </>
          )}
        </div>
        <div className={styles.cells} data-phase={phase} aria-hidden="true">
          {CELLS.map((d, i) => (
            <span key={i} style={{ "--d": `${d}ms` } as CSSProperties} />
          ))}
        </div>
      </div>
    </dialog>
  );
}
