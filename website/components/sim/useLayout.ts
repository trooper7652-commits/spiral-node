"use client";
import { useEffect, useState, type RefObject } from "react";

/** Matches a media query; the island is client-only, so reading it at first render is safe. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const h = () => setOn(mq.matches);
    h();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [query]);
  return on;
}

/** Content width of an element and the current devicePixelRatio, both live. */
export function useStage(ref: RefObject<HTMLElement | null>) {
  const [s, setS] = useState({ width: Math.max(0, window.innerWidth - 32), dpr: window.devicePixelRatio || 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setS({ width: el.clientWidth, dpr: window.devicePixelRatio || 1 });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("resize", read);
    read();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [ref]);
  return s;
}
