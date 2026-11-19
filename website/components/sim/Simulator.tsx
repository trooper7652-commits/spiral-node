"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Button } from "@/lib/sim/protocol";
import { screenScale } from "@/lib/sim/scale";
import { useDeviceKeys } from "./useDeviceKeys";
import { ART, Device, type Colourway } from "./Device";
import EinkCanvas from "./EinkCanvas";
import { ErrorPanel, ProgressPanel } from "./Panels";
import { ColourwayPicker, Guide, Tools } from "./SimPanels";
import { useMedia, useStage } from "./useLayout";
import { useSimulator } from "./useSimulator";
import styles from "./Sim.module.css";

const BEZEL = 12; // CSS px of ink around the screen on phones

/** What a host page can ask of the device: install a script and start it. Resolves to the loader error, or null. */
export type SimControl = { run: (id: string, source: string) => Promise<string | null> };

type KeyProps = {
  pressed: ReadonlySet<Button>;
  disabled: boolean;
  onPress: (b: Button, src: string) => void;
  onRelease: (b: Button, src: string) => void;
  inline: boolean;
};

function PagerKeys({ pressed, disabled, onPress, onRelease, inline }: KeyProps) {
  const key = (b: "back" | "home", label: string, cls: string) => (
    <button
      type="button"
      data-wheel=""
      data-button={b}
      data-pressed={pressed.has(b) ? "" : undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`${styles.pagerKey} ${cls}`}
      style={{ "--kx": ART.keys[b].x, "--ky": ART.keys[b].y, "--kw": ART.keys[b].w, "--kh": ART.keys[b].h } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(b, "pointer");
      }}
      onPointerUp={() => onRelease(b, "pointer")}
      onPointerCancel={() => onRelease(b, "pointer")}
      onLostPointerCapture={() => onRelease(b, "pointer")}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        onPress(b, "key");
        onRelease(b, "key");
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        // Pointer presses are handled above (detail >= 1); detail 0 is assistive-tech activation.
        if (e.detail !== 0) return;
        onPress(b, "click");
        onRelease(b, "click");
      }}
    >
      {label}
    </button>
  );
  return (
    <div className={inline ? styles.pagerRow : styles.pagerOverlay}>
      {key("back", "Back", styles.backKey)}
      {key("home", "Home", styles.homeKey)}
    </div>
  );
}

export default function Simulator({ onControl }: { onControl?: (c: SimControl) => void }) {
  const sim = useSimulator();
  const { run } = sim;
  useEffect(() => onControl?.({ run }), [onControl, run]);
  const { phase, frame, pressed, press, release, releaseAll } = sim;
  const [colourway, setColourway] = useState<Colourway>("olive");
  const [realism, setRealism] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const phone = useMedia("(max-width: 599px)");
  const stageRef = useRef<HTMLDivElement>(null);
  const { width, dpr } = useStage(stageRef);

  // The body art and the canvas share one scale: art px = cssWidth / 250 CSS px, whole device px.
  // Tall device: also cap its height to ~85% of the viewport so it fits a desktop screen.
  const avail = phone ? width - 2 * BEZEL : Math.min((width * ART.screen.w) / ART.w, (window.innerHeight * 0.85 * ART.screen.w) / ART.h);
  const { devicePx, cssWidth } = screenScale(avail, dpr);

  const running = phase.kind === "running";
  const off = !!frame?.poweredOff;

  useDeviceKeys({ press, release, releaseAll }, running);

  let screen;
  if (phase.kind === "error") screen = <ErrorPanel message={phase.message} onRetry={sim.tryAgain} />;
  else if (phase.kind === "loading") screen = <ProgressPanel stage={phase.stage} />;
  else if (frame && running) screen = <EinkCanvas frame={frame} realism={realism} devicePx={devicePx} cssWidth={cssWidth} />;
  else
    screen = (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="pixelated" src="/art/home-still.png" width={250} height={122} alt="The screen is off. It would show the Spiral OS Home screen." />
    );

  const canPower = phase.kind === "off" || off;

  return (
    <div className={styles.sim}>
      <div className={`${styles.stage} ${phone ? styles.phone : ""}`}>
        <div ref={stageRef} className={styles.stageInner}>
        <Device colourway={colourway} layout={phone ? "split" : "body"} cssWidth={cssWidth}>
          <Device.Screen>{screen}</Device.Screen>
          <PagerKeys pressed={pressed} disabled={!running || off} onPress={press} onRelease={release} inline={phone} />
          <Device.Wheel pressed={pressed} disabled={!running || off} onPress={press} onRelease={release} />
        </Device>
        </div>
      </div>
      <div className={styles.srOnly} data-testid="live" aria-live="polite" aria-atomic="true">
        {frame?.text}
      </div>
      <div className={styles.controls}>
        {canPower && (
          <button type="button" className={`btn ${styles.power}`} onClick={sim.powerOn}>
            Power on
          </button>
        )}
        <ColourwayPicker value={colourway} onChange={setColourway} />
      </div>
      <p className={styles.keys}>Buttons: Up, Down, Left, Right, Select, Back, Home. Keys: arrows, Enter or Space, Backspace or Esc for Back, H for Home. Holding the centre button also goes Back.</p>
      {phase.kind === "error" && <p className={styles.hint}>Details: {phase.detail.slice(0, 200)}</p>}
      <div className={styles.folds}>
        <Guide open={!phone} />
        <Tools
          realism={realism}
          onRealism={setRealism}
          canReset={sim.hasWorker() && (phase.kind === "running" || phase.kind === "off")}
          onReset={sim.reset}
          info={{
            screen: frame?.screen ?? "off",
            refresh: frame ? (frame.full ? "full" : "partial") : "none",
            saving: frame?.saving ? "yes" : "no",
          }}
        />
      </div>
    </div>
  );
}
