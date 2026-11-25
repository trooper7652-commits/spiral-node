"use client";
import { useState, type FormEvent } from "react";
import { writeWelcome } from "@/lib/welcome";
import { SITE } from "@/lib/site";
import styles from "./SignupForm.module.css";

/**
 * Posts the email to the newsletter service's hosted form (we never store it).
 * Without onDone it shows its own thank-you line. `fake` skips the network (?popup=now review mode).
 */
export default function SignupForm({ id, onDone, fake = false }: { id: string; onDone?: () => void; fake?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error" | "done">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    try {
      if (!fake) {
        const body = new FormData();
        body.set(SITE.newsletterEmailField, email);
        await fetch(SITE.newsletterFormUrl, { method: "POST", mode: "no-cors", body });
      }
      writeWelcome("sent"); // footer or popup: either way the popup never shows again
      setState("done");
      onDone?.();
    } catch {
      setState("error"); // the typed email stays in the field
    }
  }

  if (state === "done" && !onDone) return <p role="status">Thanks! Check your inbox to confirm.</p>;
  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={`${id}-email`}>Email</label>
      <div className={styles.row}>
        <input
          id={`${id}-email`}
          className={styles.input}
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn" disabled={state === "sending"}>
          Subscribe
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className={styles.error}>
          Couldn&rsquo;t sign you up. Try again?
        </p>
      )}
    </form>
  );
}
