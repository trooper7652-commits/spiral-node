"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Reveal.module.css";

/** Rises into view once, the first time it scrolls on screen. Server HTML, no-JS and reduced motion show it as is. */
export default function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return; // already on screen: no hide-then-show flicker
    setState("waiting");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.reveal} data-reveal={state} style={state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
