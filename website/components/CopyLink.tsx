"use client";
import { useState } from "react";

/** Copies this page's address. If the clipboard is unavailable, shows the address to select instead. */
export default function CopyLink() {
  const [state, setState] = useState<{ copied: boolean; url: string | null }>({ copied: false, url: null });

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState({ copied: true, url: null });
    } catch {
      setState({ copied: false, url });
    }
  }

  return (
    <span>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        Copy link
      </button>
      <span aria-live="polite">{state.copied ? " Copied" : ""}</span>
      {state.url && <input readOnly aria-label="Page link" value={state.url} onFocus={(e) => e.currentTarget.select()} size={40} />}
    </span>
  );
}
