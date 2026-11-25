"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Holds from "@/components/world/Holds";
import TrailMeter from "@/components/world/TrailMeter";
import WorldCanvas from "@/components/world/WorldCanvas";
import { vhPx } from "@/components/world/vh";
import { SITE } from "@/lib/site";
import { markOpened, rememberedScroll, rememberedWorld, rememberScroll, rememberWorld, shouldOpen, wasOpened } from "@/lib/opening";
import { homeWorld, SECTIONS, spanVh } from "@/lib/world/home";
import type { Frame } from "@/lib/world/types";
import s from "./HomeStory.module.css";

// True once this page load has decided: only its first mount may offer the opening. A router back/forward to "/" or a link from another page mounts again later and never gets it.
let decided = false;

/**
 * True when the page starts at its top: this is the first mount of the document load, the document itself is the home page (not a client-side arrival
 * from another page), no scroll, no #section, and the load is neither a reload nor a back/forward step.
 * A reload never decides afresh (the browser restores its scroll position after this runs, and a spacer added then would drop the visitor into another
 * scene): it keeps the world the tab had (see `reloaded`), and with no stored world it gets no opening.
 */
function startsAtTop(first: boolean) {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return first && landedHere(nav) && scrollY === 0 && !location.hash && (!nav || nav.type === "navigate" || nav.type === "prerender");
}
const landedHere = (nav?: PerformanceNavigationTiming) => !nav || new URL(nav.name, location.href).pathname === location.pathname;

/** The tab's own world, when this is a reload of this same document: a reload keeps the scene under the restored scroll, and a reload at the very top of an opening page shows s0 again (it replays over nothing). */
function reloaded(first: boolean): boolean | null {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return first && nav?.type === "reload" && landedHere(nav) ? rememberedWorld() : null;
}

/** restoreTo: the scroll px to go back to once the world's spacer is in place (a reload, or a Back to the home page), else null for the top. */
type Start = { sky: "sunset" | "night"; opening: boolean; restoreTo: number | null };

// The home page's last scroll position and world, kept while it is mounted, and the path of the last Back/Forward step (popstate): a Back to "/" that finds an opening world here
// rebuilds that same world and scroll, since the browser cannot (the page has "manual" restoration and the spacer is only added after mount).
let last: { y: number; sky: Start["sky"]; opening: boolean } | null = null;
let poppedTo: string | null = null;
if (typeof window !== "undefined") addEventListener("popstate", () => (poppedTo = location.pathname));

// The sky and the opening are decided once, after mount and in one step, before the canvas exists: so the server and the first client render agree (the sections in flow, no canvas yet), and the very first frame already maps the scroll position to the right shot. A start that is not at the top never gets the opening, so a deep link or a restored scroll keeps its scene.
export default function HomeStory({ children }: { children: ReactNode }) {
  const [start, setStart] = useState<Start | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const choice = useRef<Start | null>(null); // kept across a development double run of the effect
  useEffect(() => {
    if (!choice.current) {
      const asked = new URLSearchParams(window.location.search).get("scene");
      const first = !decided;
      decided = true;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const kept = reloaded(first);
      // a later mount that a Back step brought to "/", from a home page that had the opening: the same world again (other later mounts stay as they are: no opening)
      const back = !first && poppedTo === "/" && last?.opening && SITE.opening !== "off" && !reduced ? last : null;
      poppedTo = null;
      const opening = kept !== null ? kept && SITE.opening !== "off" && !reduced : back ? true : shouldOpen(SITE.opening, wasOpened(), startsAtTop(first), reduced);
      rememberWorld(opening);
      choice.current = {
        sky: back ? back.sky : asked === "night" || asked === "sunset" ? asked : Math.random() < 0.5 ? "sunset" : "night",
        opening,
        restoreTo: !opening ? null : back ? back.y : kept !== null ? rememberedScroll() : null,
      };
    }
    setStart(choice.current);
  }, []);
  const opening = start?.opening ?? false;
  const world = useMemo(() => homeWorld(start?.sky ?? "sunset", { opening }), [start, opening]);

  // A scroll between reading the start and the spacer landing would shift the visitor: the opening always begins at the top.
  // A reload of an opening page goes back to where it was left, here, once the spacer is in the page and before the first frame: the browser's own restore would run against the page
  // without the spacer (it is only added after mount) and land in another scene. So an opening page takes the scroll restoration over (manual) and saves its position when it is left.
  const restoreTo = start?.restoreTo ?? null;
  useLayoutEffect(() => {
    if (!opening) return;
    history.scrollRestoration = "manual"; // only while on "/" (WelcomePopup hands it back on any other path); never with reduced motion, which has no opening
    scrollTo({ top: restoreTo ?? 0, behavior: "instant" });
    const save = () => rememberScroll(scrollY);
    addEventListener("pagehide", save);
    return () => removeEventListener("pagehide", save);
  }, [opening, restoreTo]);

  // Where the home page is, for a Back to it. A layout effect, so it stops before the router scrolls the next page to its top.
  const sky = start?.sky;
  useLayoutEffect(() => {
    if (!sky) return;
    const rec = () => (last = { y: scrollY, sky, opening });
    rec();
    addEventListener("scroll", rec, { passive: true });
    return () => {
      removeEventListener("scroll", rec);
      poppedTo = null; // a Back that was already handled here is not for the next mount
    };
  }, [sky, opening]);

  // The opening counts as seen once the visitor is past it (scene 1 reached, by scrolling, a key, the trail or Skip).
  // A deep-link first visitor (#section, restored scroll) lands past it without it being offered, and is not marked: their first visit to the top still plays it.
  const passed = !!frame && frame.a.shot !== "s0";
  useEffect(() => {
    if (opening && passed) markOpened();
  }, [opening, passed]);

  const showSkip = opening && (!frame || frame.a.shot === "s0");
  // Skip goes to the Skip button's host at the very start of the body, so it is the page's first Tab stop; it is made while the opening shows.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!showSkip) return;
    const el = document.createElement("div");
    document.body.prepend(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [showSkip]);

  // Straight to where scene 1 starts, with its panel in; focus then moves to the panel's heading (once the frame says scene 1's hold is live, so the hold's own focus handler does not scroll), as the button is gone.
  const refocus = useRef(false);
  const skip = useCallback(() => {
    markOpened();
    refocus.current = true;
    scrollTo({ top: (spanVh(world, 0) * vhPx()) / 100, behavior: "instant" });
  }, [world]);
  useEffect(() => {
    if (!refocus.current || frame?.hold !== "s1-hold") return;
    refocus.current = false;
    const root = document.querySelector<HTMLElement>('[data-hold="s1-hold"]');
    const target = root?.querySelector<HTMLElement>("h1, h2") ?? root?.querySelector<HTMLElement>("[data-panel]");
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [frame]);
  useEffect(() => {
    if (!showSkip) return;
    const key = (e: KeyboardEvent) => {
      // not when something else took the key (a menu, the signup popup) or a dialog is open
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[role="dialog"], dialog[open]')) return;
      skip();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [showSkip, skip]);

  // The opening's ground is paper: the header's wordmark turns to ink while it shows (see StoryHeaderState.module.css).
  const onPaper = opening && (!frame || (frame.a.shot === "s0" && frame.mix < 0.5));
  const scene = frame ? SECTIONS.indexOf(frame.a.shot) : opening ? -1 : 0; // -1: the opening, before scene 1
  useEffect(() => {
    document.documentElement.dataset.snScene = String(scene); // read by a listener that attaches after this effect ran
    window.dispatchEvent(new CustomEvent("sn:scene", { detail: scene }));
  }, [scene]);
  return (
    <div data-testid="story" data-sky={start?.sky} data-opening={start ? String(opening) : undefined} data-light-ground={onPaper ? "" : undefined}>
      {showSkip &&
        host &&
        createPortal(
          <button type="button" className={s.skip} data-testid="skip-opening" onClick={skip}>
            Skip
          </button>,
          host,
        )}
      {/* the opening's scroll length, in front of the nine sections (each is as long as its shot and join) */}
      {opening && <div aria-hidden="true" style={{ height: `${spanVh(world, 0)}vh` }} />}
      <div data-testid="story-text">
        <Holds world={world} frame={frame}>
          {children}
        </Holds>
      </div>
      {start && <WorldCanvas world={world} spacer={false} onFrame={setFrame} />}
      {/* last in the page order: the scenes' own content comes first for keyboards */}
      {start && <TrailMeter world={world} index={scene} />}
    </div>
  );
}
