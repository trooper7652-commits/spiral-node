"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import { fetchStars } from "@/lib/github";
import { readState, shouldShow, SHOW_AFTER_MS } from "@/lib/popup";
import { readWelcome, writeWelcome, welcomeBody } from "@/lib/welcome";
import { SITE } from "@/lib/site";
import styles from "./WelcomePopup.module.css";

/** The form. `extra` shows the two extra questions; the popup passes SITE.welcomeExtraFields. */
export function WelcomeForm({ extra, fake, onSent, onSkip }: { extra: boolean; fake: boolean; onSent: () => void; onSkip: () => void }) {
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // state is stale within one tick; the ref blocks a second submit
  const [error, setError] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [broughtHere, setBroughtHere] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(false);

    try {
      if (!fake) {
        const body = welcomeBody({ email, firstName, occupation, broughtHere });
        // the timeout turns a hung reply into the alert
        await fetch(SITE.newsletterFormUrl, { method: "POST", mode: "no-cors", body, signal: AbortSignal.timeout?.(10_000) }); // an old browser without it posts with no time limit
      }
      onSent();
    } catch {
      setError(true);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 id="welcome-title" className={styles.title}>Welcome</h2>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="welcome-firstname">First name</label>
        <input
          id="welcome-firstname"
          className={styles.input}
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </div>

      {extra && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="welcome-occupation">What you do</label>
            <select
              id="welcome-occupation"
              className={styles.select}
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            >
              <option value=""></option>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="maker">maker</option>
              <option value="engineer">engineer</option>
              <option value="writer">writer</option>
              <option value="other">other</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="welcome-brought">What brought you here</label>
            <input
              id="welcome-brought"
              className={styles.input}
              type="text"
              value={broughtHere}
              onChange={(e) => setBroughtHere(e.target.value)}
            />
          </div>
        </>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="welcome-email">Email</label>
        <input
          id="welcome-email"
          className={styles.input}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <p className={styles.note}>We keep these with your email to know who is reading. Nothing else is collected.</p>

      <div className={styles.buttons}>
        <button type="submit" className="btn" disabled={sending}>
          Send
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSkip}>
          Skip
        </button>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          Couldn&rsquo;t send that. Try again?
        </p>
      )}
    </form>
  );
}

export default function WelcomePopup() {
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [fake, setFake] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef(false);
  const [stars, setStars] = useState<number | null>(null);

  // The home page takes scroll restoration over only while it shows (HomeStory, "manual"); entries made from it inherit that, so every other path hands it back to the browser.
  useEffect(() => {
    if (path !== "/") history.scrollRestoration = "auto";
  }, [path]);

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("popup") === "now";
    setFake(forced && !SITE.newsletterFormUrl);
    // The old timing rules (lib/popup.ts) decide; any sn-welcome value means never again.
    const ok = (visibleMs: number) =>
      (forced || readWelcome() === null) && // ?popup=now is a review mode: it ignores the stored answer
      shouldShow({ ...readState(), now: Date.now(), visibleMs, path, forced, formUrl: SITE.newsletterFormUrl });

    if (forced) {
      if (ok(0)) setOpen(true);
      return;
    }
    if (path === "/") {
      // Home: scene 2 replaces the 60 s timer. HomeStory may have announced its scene before this listener attached, so read it too.
      const check = (scene: number) => {
        if (scene >= 1 && ok(SHOW_AFTER_MS)) setOpen(true);
      };
      check(Number(document.documentElement.dataset.snScene ?? -1));
      const onScene = (e: Event) => check((e as CustomEvent<number>).detail);
      window.addEventListener("sn:scene", onScene);
      return () => window.removeEventListener("sn:scene", onScene);
    }
    let visibleMs = 0;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") visibleMs += 1000;
      if (ok(visibleMs)) {
        setOpen(true);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [path]);

  // The header's "Join the launch list" button opens the form whatever was answered before.
  useEffect(() => {
    const onAsk = () => {
      setFake(!SITE.newsletterFormUrl);
      setOpen(true);
    };
    window.addEventListener("sn:open-welcome", onAsk);
    return () => window.removeEventListener("sn:open-welcome", onAsk);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Skip, Close and Escape (the native cancel) all end in the dialog's close event: the one place that writes.
  function onClose() {
    if (!sentRef.current && readWelcome() === null) writeWelcome("skipped");
    setOpen(false);
  }
  const close = () => ref.current?.close();

  function onSent() {
    writeWelcome("sent");
    sentRef.current = true;
    setSent(true);
    fetchStars(SITE.repoApi).then(setStars);
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="welcome-title"
      data-testid="welcome-popup"
      onClose={onClose}
    >
      <div className={styles.inner}>
        <Panel label="WELCOME">
          {!sent ? (
            <WelcomeForm extra={SITE.welcomeExtraFields} fake={fake} onSent={onSent} onSkip={close} />
          ) : (
            <div className={styles.thanks}>
              <h2 id="welcome-title" className={styles.title}>Thanks! Check your inbox to confirm.</h2>
              <p>One more thing: star Spiral Node on GitHub.</p>
              <div className={styles.row}>
                <a className="btn" href={SITE.repoUrl} target="_blank" rel="noopener">
                  Star on GitHub
                </a>
                {stars !== null && <span>{stars.toLocaleString("en")} {stars === 1 ? "star" : "stars"}</span>}
                <a href={`${SITE.repoUrl}/blob/main/CONTRIBUTING.md`}>or write a script</a>
              </div>
              <div className={styles.buttons}>
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Close
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </dialog>
  );
}
