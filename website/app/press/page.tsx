import type { Metadata } from "next";
import DemoVideo from "@/components/DemoVideo";
import Page from "@/components/Page";
import { og } from "@/lib/meta";
import { SITE } from "@/lib/site";
import styles from "./press.module.css";

export const metadata: Metadata = og("press", "Press | Spiral Node", "The Spiral Node logo, device art and story.");

export default function PressPage() {
  return (
    <Page band="countryside" title="Press">
      <h2>The story</h2>
      <p>
        Spiral Node is a pocket e-ink device that hands you ideas and leaves the thinking to you. Every 15, 30 or 60 seconds it shows
        something to think about: a fun fact and a question, a short story, or two random topics to connect. It is fully offline, and its
        software, Spiral OS, is open source, so anyone can write a script for it. The hardware is a prototype in progress, made by Helix
        Velocities.
      </p>
      <h2>Demo video</h2>
      <p>A 25-second tour of the simulator: chess puzzles, then a poem. No sound.</p>
      <DemoVideo />
      <h2>Downloads</h2>
      <div className={styles.assets}>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pixelated" src="/press/spiral-node-logo.png" width={128} height={128} alt="The Spiral Node logo: a spiral." />
          <figcaption>
            <a href="/press/spiral-node-logo.png" download>
              Spiral logo (PNG, 512x512)
            </a>
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pixelated"
            src="/art/hero-device-olive.png"
            width={200}
            height={132}
            alt="Spiral Node in olive: a landscape pager with the e-ink screen across the top, Back and Home keys bottom left and a spiral wheel bottom right."
          />
          <figcaption>
            <a href="/art/hero-device-olive.png" download>
              Device art, olive (PNG)
            </a>
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/og/home.png" width={300} height={158} alt="Spiral Node in front of a pixel-art sunset." />
          <figcaption>
            <a href="/og/home.png" download>
              Banner (PNG, 1200x630)
            </a>
          </figcaption>
        </figure>
      </div>
      <p>The art is original pixel art, shared under CC BY-SA 4.0.</p>
      <h2>Contact</h2>
      <p>
        Questions or interview requests: start a thread in <a href={SITE.discussionsUrl}>GitHub Discussions</a>.
      </p>
    </Page>
  );
}
