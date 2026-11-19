import type { Metadata } from "next";
import Link from "next/link";
import Hero from "@/components/hero/Hero";
import Section from "@/components/Section";
import FeatureGrid from "@/components/FeatureGrid";
import DeviceDiagram from "@/components/DeviceDiagram";
import ExploreRow from "@/components/ExploreRow";
import CommunitySpotlight from "@/components/CommunitySpotlight";
import ScriptCards from "@/components/ScriptCards";
import { FAQ, ROADMAP } from "@/lib/content";
import { listPosts } from "@/lib/devlog";
import { og } from "@/lib/meta";
import { listScripts } from "@/lib/scripts";
import styles from "./page.module.css";

export const metadata: Metadata = og(
  "home",
  "Spiral Node by Helix Velocities",
  "A pocket e-ink device that hands you ideas and leaves the thinking to you. Offline. Open source.",
);

export default function HomePage() {
  const latest = listPosts()[0];
  return (
    <>
      <Hero />
      <Section id="purpose" title="Something to think about." tone="cloud">
        <p className={styles.purpose}>
          <strong>Spiral Node is a pocket e-ink device for people who like to think.</strong> It hands you one thing to think about at a time, then leaves the thinking to you. Offline and open source, made by Helix Velocities.
        </p>
      </Section>
      <ExploreRow />
      <Section id="features" title="Design features" tone="paper">
        <FeatureGrid />
      </Section>
      <Section id="design" title="The design" tone="cloud">
        <DeviceDiagram />
        <p className={styles.parts}>
          Prototype parts, being tested: Orange Pi Zero 2W (1.5 GB) &middot; 2.13 inch e-paper display, 250x122, black and white &middot; PiSugar 3 power board &middot; a 1,800 mAh flat battery. Battery life: all day is the goal; it hasn&rsquo;t been measured yet.
        </p>
      </Section>
      <Section id="community" title="Community" tone="paper">
        <p>For visionaries, artisans, crafters, makers, doers, designers, innovators and operators who love thinking. Scripts are plain Python, so anyone can write one and share it.</p>
        <CommunitySpotlight />
      </Section>
      <Section id="scripts" title="Scripts" tone="cloud">
        <p>Small loops that show something to think about. Run one right now in the simulator.</p>
        <ScriptCards scripts={listScripts().slice(0, 3)} />
        <p className={styles.more}>
          <Link href="/scripts">See all scripts</Link>
        </p>
      </Section>
      <Section id="roadmap" title="Roadmap" tone="paper">
        <ol className={styles.roadmap}>
          {ROADMAP.map((r) => (
            <li key={r.text}>
              <span className={styles.mark} aria-hidden="true">{r.done ? "✓" : "·"}</span>
              <span className={styles.sr}>{r.done ? "Done: " : "Next: "}</span>
              {r.href ? <Link href={r.href}>{r.text}</Link> : r.text}
            </li>
          ))}
        </ol>
      </Section>
      <Section id="faq" title="Questions" tone="cloud">
        <div className={styles.faq}>
          {FAQ.map((f) => (
            <details key={f.q} className={styles.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
      <Section id="devlog" title="Latest devlog" tone="paper">
        <h3 className={styles.post}>
          <Link href={`/devlog/${latest.slug}`}>{latest.title}</Link>
        </h3>
        <p>
          <time dateTime={latest.date}>{latest.date}</time>
        </p>
        <p>{latest.summary}</p>
        <p>
          <Link href="/devlog">All devlog entries</Link>
        </p>
      </Section>
    </>
  );
}
