"use client";
import { useEffect, useRef, useState } from "react";
import art from "../../public/art/device.json";
import { screenScale } from "@/lib/sim/scale";
import { Device } from "../sim/Device";
import EinkCanvas from "../sim/EinkCanvas";
import { ErrorPanel, ProgressPanel } from "../sim/Panels";
import { useDeviceKeys } from "../sim/useDeviceKeys";
import { useSimulator } from "../sim/useSimulator";
import styles from "./Hero.module.css";

/** The real Spiral OS inside the hero device's screen rect. Fills its parent (the hero device box), which has the art's aspect ratio. */
export default function HeroDemo() {
  const sim = useSimulator();
  const { phase, frame, pressed, press, release, releaseAll, powerOn } = sim;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: art.width, dpr: 1 });
  const running = phase.kind === "running";
  const focused = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, dpr: window.devicePixelRatio || 1 });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    powerOn();
  }, [powerOn]);

  // Tell the rest of the page (the scenery, the email popup) a demo is live.
  useEffect(() => {
    document.documentElement.dataset.demo = "running";
    return () => {
      delete document.documentElement.dataset.demo;
    };
  }, []);

  useEffect(() => {
    if (running && !focused.current) {
      focused.current = true;
      box.current?.focus();
    }
  }, [running]);

  useDeviceKeys({ press, release, releaseAll }, running, box);

  // The canvas draws at a whole device-px scale; its CSS size follows the art exactly so it fills the screen window.
  const cssWidth = (size.w * art.screen.w) / art.width;
  const { devicePx } = screenScale(cssWidth, size.dpr);

  let screen;
  if (phase.kind === "error") screen = <ErrorPanel message={phase.message} onRetry={sim.tryAgain} />;
  else if (phase.kind === "loading" || phase.kind === "off" || !frame) screen = <ProgressPanel stage={phase.kind === "loading" ? phase.stage : "runtime"} />;
  else screen = <EinkCanvas frame={frame} realism={false} devicePx={devicePx} cssWidth={cssWidth} />;

  return (
    <div ref={box} className={styles.demo} tabIndex={0} data-testid="hero-demo">
      <Device colourway="olive" layout="embedded" cssWidth={cssWidth} aria-label="Spiral Node live demo. Use the wheel, or the arrow keys, Enter and Escape.">
        <Device.Screen>{screen}</Device.Screen>
        <Device.Wheel pressed={pressed} disabled={!running || !!frame?.poweredOff} onPress={press} onRelease={release} />
      </Device>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {frame?.text}
      </div>
    </div>
  );
}
