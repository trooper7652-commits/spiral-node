import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import sec from "@/components/Section.module.css";
import DemoVideo from "@/components/DemoVideo";
import LaunchButtons from "@/components/LaunchButtons";
import StickyLaunchBar from "@/components/StickyLaunchBar";
import DeviceDiagram from "@/components/DeviceDiagram";
import DeviceInk from "@/components/DeviceInk";
import PhotoSlot from "@/components/PhotoSlot";
import SignupForm from "@/components/SignupForm";
import PageBand from "@/components/PageBand";
import Panel from "@/components/Panel";
import { FAQ } from "@/lib/content";
import { FEATURES } from "@/lib/features";
import { BENEFIT_IDS, DAY, DOESNT, HERO_BULLETS, HOW, PRODUCT_FAQ, SPECS, STATUS, imageById } from "@/lib/product";
import { og } from "@/lib/meta";
import { getScript } from "@/lib/scripts";
import { SITE } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = og("home", "The device | Spiral Node", "A pocket e-ink device that hands you something to think about. Offline and open source.");

export default function ProductPage() {
  const benefits = BENEFIT_IDS.map((id) => FEATURES.find((f) => f.id === id)!);
  const faq = PRODUCT_FAQ.map((q) => FAQ.find((f) => f.q === q)!);
  return (
    <div className={styles.page}>
      <PageBand scene="device" rows={60} />
      <div className={styles.innerPage} data-shell="">
        <section aria-labelledby="hero-h" className={`${sec.section} ${sec.cloud}`}>
          <div className={sec.inner}>
            <Panel label="Spiral Node">
              <div className={styles.hero}>
              <div className={styles.copy}>
                <h1 id="hero-h" className={styles.h1}>Spiral Node</h1>
                <p className={styles.line}>Something to think about. In your pocket.</p>
                <ul className={styles.bullets}>
                  {HERO_BULLETS.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p>
                  <span className="badge">{STATUS}</span>
                </p>
                <div id="hero-cta">
                  <LaunchButtons />
                </div>
                <p className={styles.demo}>
                  <Link href="/try">Try the demo</Link>
                </p>
              </div>
              <div className={styles.art}>
                <DeviceInk face="front" label="Spiral Node, a drawing of the planned pager" />
              </div>
              <div className={styles.clip}>
                <DemoVideo />
              </div>
              </div>
            </Panel>
          </div>
        </section>
        <Section id="why" title="Why Spiral Node" tone="paper">
          <ul className={styles.cards}>
            {benefits.map((f) => (
              <li key={f.id} className={`pixel-box ${styles.card}`}>
                <span className={styles.medal} aria-hidden="true">{f.title.charAt(0)}</span>
                <h3 className={styles.time}>{f.title}</h3>
                <p>{f.line}</p>
              </li>
            ))}
          </ul>
        </Section>
        <Section id="day" title="A day with it" tone="paper">
          <ul className={styles.cards}>
            {DAY.map((d) => {
              const name = getScript(d.script)?.name ?? d.script;
              return (
                <li key={d.script} className={`pixel-box ${styles.card}`}>
                  <h3 className={styles.time}>{d.time}</h3>
                  <p>{d.line}</p>
                  <img className={`pixelated ${styles.shot}`} src={`/og/script-${d.script}.png`} alt={`${name} on the Spiral Node screen`} width={1200} height={630} loading="lazy" />
                  <Link className="btn" href={`/try?script=${d.script}`}>Run in simulator</Link>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section id="how" title="How it works" tone="cloud">
          <ol className={styles.list}>
            {HOW.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        </Section>
        <Section id="design" title="The design" tone="paper">
          <DeviceDiagram />
          <div className={styles.pair}>
            {["front", "in-hand", "sketch-front"].map((id) => (
              <PhotoSlot key={id} image={imageById(id)} />
            ))}
          </div>
        </Section>
        <Section id="specs" title="Specs" tone="cloud">
          <dl className={styles.specs}>
            {SPECS.map((s) => (
              <div key={s.label} className={styles.row}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section id="not" title="What it doesn't do" tone="paper">
          <ul className={styles.list}>
            {DOESNT.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
        <Section id="questions" title="Questions" tone="cloud">
          <div className={styles.faq}>
            {faq.map((f) => (
              <details key={f.q} className={styles.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
        <Section id="get-updates" title="Join the launch list" tone="paper">
          {SITE.newsletterFormUrl ? <SignupForm id="product" /> : <p>Email updates are coming soon. Until then, star the repo to follow along.</p>}
          <p>
            <a className="btn btn-secondary" href={SITE.repoUrl}>★ Star on GitHub</a>
          </p>
        </Section>
        <StickyLaunchBar ctaId="hero-cta" signupId="get-updates-h" />
      </div>
    </div>
  );
}
