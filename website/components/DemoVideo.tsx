"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DemoVideo.module.css";

export default function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // play only after hydration, and never under reduced motion
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) void v.play().catch(() => {});
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className={styles.wrap}>
      <video
        ref={ref}
        className={styles.video}
        muted
        loop
        playsInline
        controls
        preload="none"
        poster="/press/demo-poster.png"
        width={1280}
        height={720}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        <source src="/press/demo.webm" type="video/webm" />
      </video>
      <p className={styles.row}>
        <button type="button" className="btn" aria-pressed={paused} onClick={toggle}>
          Pause video
        </button>{" "}
        <a href="/press/demo.webm" download>
          Download the video (WebM, 1280x720)
        </a>
      </p>
    </div>
  );
}
