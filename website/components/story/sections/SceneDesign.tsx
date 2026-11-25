import StorySection from "@/components/story/StorySection";
import { tagItems } from "@/lib/world/tags";
import DeviceSketch from "./DeviceSketch";
import styles from "./sections.module.css";

export default function SceneDesign() {
  return (
    <StorySection
      id="s4"
      labelledBy="design-h"
      label="Prototype"
      more={
        <>
          <DeviceSketch />
          <p className={styles.note}>
            Prototype parts, being tested: Orange Pi Zero 2W (1.5 GB) &middot; 2.13 inch e-paper display, 250x122, black and white &middot; PiSugar 3 power board &middot; a 1,800 mAh flat battery. Battery life: all day is the goal; it hasn&rsquo;t been measured yet.
          </p>
          <ul>
            {tagItems("s4").map((p) => (
              <li key={p.id}>
                <strong>{p.label}</strong>: {p.body}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <h2 id="design-h">The <span className={styles.accent}>design</span></h2>
      <p>A sketch of the prototype: the e-ink screen, the spiral wheel, Back and Home, and the USB-C top.</p>
    </StorySection>
  );
}
