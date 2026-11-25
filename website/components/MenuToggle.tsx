"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./SiteHeader.module.css";

// The nav links arrive as server-rendered children; this only holds the open state and the button.
export default function MenuToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Escape with the Menu closed dismisses the preview card of the hovered or focused link;
  // the mark is cleared once that link has neither hover nor keyboard focus (see onLeave).
  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll<HTMLElement>("#site-nav a[aria-describedby]").forEach((a) => {
        if (a.matches(":hover, :focus")) a.dataset.dismissed = "true";
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const onLeave = (e: { target: EventTarget }) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("a[data-dismissed]");
    // read hover and focus after the browser has updated them
    if (a) setTimeout(() => a.matches(":hover, :focus-visible") || delete a.dataset.dismissed, 0);
  };
  return (
    <div
      className={styles.menu}
      data-open={open}
      onMouseOut={onLeave}
      onBlur={onLeave}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>("#site-nav a");
        if (!a) return;
        a.dataset.dismissed = "true"; // focus stays on the link after navigation; keep its card shut
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button ref={button} type="button" className={styles.toggle} aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
        Menu
      </button>
      {children}
    </div>
  );
}
