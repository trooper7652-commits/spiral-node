"use client";
import { useEffect } from "react";

export default function Grain() {
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const g = c.getContext("2d");
    if (!g) return;
    const d = g.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (120 + Math.random() * 135) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    document.documentElement.style.setProperty("--grain", `url(${c.toDataURL()})`);
  }, []);
  return (
    <div
      aria-hidden="true"
      data-grain=""
      style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none", backgroundImage: "var(--grain)", backgroundSize: "192px", imageRendering: "pixelated", opacity: 0.13, mixBlendMode: "multiply" }}
    />
  );
}
