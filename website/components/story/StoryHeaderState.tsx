"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./StoryHeaderState.module.css";

export default function StoryHeaderState({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wrap = useRef<HTMLDivElement>(null);
  const [story, setStory] = useState(false);
  const [away, setAway] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const revealY = useRef(0);
  const shown = useRef(false); // mirrors `revealed` so handlers can read it without a state updater
  const reveal = (v: boolean) => {
    shown.current = v;
    setRevealed(v);
  };

  const sections = () => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="story-text"] [data-scene]'));
  // keyboard focus on the header keeps the links on screen; keyboard focus on the spiral
  // freezes the state as it is (mouse focus counts as neither)
  const headerFocus = () => {
    const a = document.activeElement;
    return !!a?.closest("header") && !!wrap.current?.contains(a) && a.matches(":focus-visible");
  };
  const spiralKeyboardFocus = () => {
    const a = document.activeElement;
    return !!a && !!wrap.current?.contains(a) && !a.closest("header") && a.matches(":focus-visible");
  };
  const menuToggle = () => wrap.current?.querySelector<HTMLButtonElement>('header button[aria-controls="site-nav"]');

  useEffect(() => {
    const has = sections().length > 1;
    setStory(has);
    setAway(false);
    reveal(false);
    if (!has) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const s = sections();
      if (s.length < 2) return;
      const second = s[1].getBoundingClientRect().top;
      const last = s[s.length - 1].getBoundingClientRect().top;
      // a short landscape screen (the same test as holds.module.css) has its panels up at the top edge: there the header stays behind the spiral so it never covers a panel
      const short = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
      const isAway = short || (second <= 0 && last > window.innerHeight / 2);
      setAway(isAway);
      if (isAway && headerFocus()) {
        revealY.current = window.scrollY;
        reveal(true);
      } else if (spiralKeyboardFocus()) {
        // frozen: neither reveal nor re-hide
      } else if (Math.abs(window.scrollY - revealY.current) > 80) {
        const menu = menuToggle();
        if ((shown.current || isAway) && menu?.getAttribute("aria-expanded") === "true") menu.click();
        reveal(false);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  const hidden = story && away && !revealed;

  useEffect(() => {
    const nav = wrap.current?.querySelector("nav");
    if (nav) nav.inert = hidden;
  }, [hidden]);

  const toggle = () => {
    revealY.current = window.scrollY;
    const next = !shown.current;
    reveal(next);
    const menu = menuToggle();
    // phones: the header's own Menu toggle holds the links
    if (menu && menu.offsetParent !== null && (menu.getAttribute("aria-expanded") === "true") !== next) menu.click();
  };

  return (
    <div
      ref={wrap}
      className={styles.wrap}
      data-story={story}
      data-hidden={hidden}
      data-revealed={story && away && revealed}
      onFocus={(e) => {
        // the spiral's own focus (from a click) must not reveal; its click toggles
        if (story && away && (e.target as HTMLElement).closest("header")) {
          revealY.current = window.scrollY;
          reveal(true);
        }
      }}
    >
      {story && away && (
        <button
          type="button"
          className={styles.spiral}
          aria-label={revealed ? "Hide links" : "Show links"}
          aria-expanded={revealed}
          aria-controls="site-nav"
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
            <path d="M12 12c0-1 1-1.6 1.8-1.2 1.2.6 1.2 2.4 0 3.3-1.6 1.2-4 .4-4.6-1.5-.8-2.4 1-4.8 3.4-5.1 3.2-.4 5.8 2.2 5.6 5.3-.2 3.9-3.8 6.6-7.6 6-4.6-.7-7.4-5.2-6.4-9.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}
