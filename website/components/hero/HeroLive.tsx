"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import art from "../../public/art/device.json";
import styles from "./Hero.module.css";

// Nothing of the simulator (worker, Pyodide) is fetched until the visitor clicks.
const HeroDemo = dynamic(() => import("./HeroDemo"), { ssr: false });

/** The hero device (with its turning wheel) and the buttons under it. "Try it right here" boots Spiral OS inside the device's screen. */
export default function HeroLive() {
  const [live, setLive] = useState(false);
  const router = useRouter();
  // Phones: the hero device is too small for a readable screen, so the button opens the full simulator instead.
  const start = () => (window.matchMedia("(max-width: 599px)").matches ? router.push("/try") : setLive(true));

  return (
    <>
      {/* 1x always (the device is wide); under 340 px it shrinks fractionally (shortcut). */}
      <div className={styles.deviceBox}>
        <img
          className={`pixelated ${styles.device}`}
          src="/art/hero-device-olive.png"
          width={art.width}
          height={art.height}
          alt="Pixel-art Spiral Node, a landscape olive pager: the e-ink screen across the top shows a fun fact and a question; below it are Back and Home keys on the left and a round spiral wheel with a copper ring on the right."
          fetchPriority="high"
        />
        <img
          aria-hidden="true"
          alt=""
          className={`pixelated ${styles.wheel}`}
          src="/art/hero-wheel-olive.png"
          style={{
            left: `${((art.wheel.cx - (art.wheelSprite.size - 1) / 2) / art.width) * 100}%`,
            top: `${((art.wheel.cy - (art.wheelSprite.size - 1) / 2) / art.height) * 100}%`,
            width: `${(art.wheelSprite.size / art.width) * 100}%`,
          }}
        />
        {live && <HeroDemo />}
      </div>
      <div className={styles.ctas}>
        {!live && (
          <button type="button" className="btn btn-big" onClick={start}>
            Try it right here
          </button>
        )}
        <Link href="/try" className={styles.full}>
          Open the full simulator
        </Link>
      </div>
    </>
  );
}
