"use client";

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Panel from "@/components/Panel";
import { HoldFrame } from "@/components/world/Holds";
import Tags from "@/components/world/Tags";
import t from "@/components/world/Tags.module.css";
import { SECTIONS } from "@/lib/world/home";
import { TAG_SECTIONS, tagItems, type TagSection } from "@/lib/world/tags";

/**
 * A hold's panel: it blinks once when it becomes the live one (all panels share one throttle). Without a frame (no script yet) there is no key, so no blink.
 * section: the hold's section id. In a tagged one (s3, s4, s6, s7) the tags pinned to the art (rendered into the section's `data-tags` host) pick an item whose text takes the panel; Escape, or a tap elsewhere on touch, brings the section's own text back.
 */
export default function HoldPanel({ label, count, section, children }: { label: string; count: string; section?: string; children: ReactNode }) {
  const frame = useContext(HoldFrame);
  const tagged = section && TAG_SECTIONS.includes(section) ? (section as TagSection) : null;
  const items = useMemo(() => (tagged ? tagItems(tagged) : []), [tagged]);
  const [pick, setPick] = useState<string | null>(null);
  const [host, setHost] = useState<Element | null>(null);
  const onScreen = !!section && frame?.hold === `${section}-hold`;
  const live = !!tagged && onScreen;

  // The same switch as scene 9's signs: on a tall or short screen the tags are a row of chips in the panel, under its heading.
  const [chips, setChips] = useState(false);
  const [row, setRow] = useState<Element | null>(null);
  const lines = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mq = matchMedia("(orientation: portrait), (max-height: 500px)");
    const sync = () => setChips(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const head = lines.current?.firstElementChild;
    if (!tagged || !chips || !head) return;
    const el = document.createElement("div");
    el.dataset.chips = "";
    head.after(el);
    setRow(el);
    return () => { el.remove(); setRow(null); };
  }, [tagged, chips]);
  useEffect(() => setHost(tagged ? document.querySelector(`[data-tags="${tagged}"]`) : null), [tagged]);
  useEffect(() => { if (!live) setPick(null); }, [live]);
  useEffect(() => {
    if (pick === null) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPick(null);
    const away = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !(e.target as Element).closest("[data-panel], [data-tags]")) setPick(null);
    };
    addEventListener("keydown", key);
    addEventListener("pointerdown", away);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", away);
    };
  }, [pick]);

  const picked = items.find((i) => i.id === pick);
  // The panel that becomes live blinks (0 -> 1), and the live one again when a tag is picked ("<scene>:<id>"); the others stay at 0 and never blink. No frame, no key.
  const scene = SECTIONS.indexOf(frame?.a.shot ?? "");
  const blinkKey = !frame ? undefined : !onScreen ? 0 : picked ? `${scene}:${picked.id}` : 1;
  return (
    <>
      <Panel label={label} count={count} blinkKey={blinkKey}>
        {/* while an item shows, the heading (first child) stays and the lines after it are hidden, still in the page */}
        <div ref={lines} className={t.lines} data-picked={!!picked}>{children}</div>
        <div className={t.pick} aria-live="polite">
          {picked && (
            <>
              <h3>{picked.label}</h3>
              <p>{picked.body}</p>
              <button type="button" className={t.back} onClick={() => setPick(null)}>Back</button>
            </>
          )}
        </div>
      </Panel>
      {tagged && (chips ? row : host) && createPortal(<Tags key={String(chips)} section={tagged} items={items} picked={pick} chips={chips} onPick={setPick} />, (chips ? row : host)!)}
    </>
  );
}
