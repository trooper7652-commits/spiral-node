import type { CSSProperties, ReactNode } from "react";
import { homeWorld, SECTIONS, spanVh } from "@/lib/world/home";
import { TAG_SECTIONS } from "@/lib/world/tags";
import Names from "@/components/world/Names";
import HoldPanel from "./HoldPanel";
import s from "./StorySection.module.css";

const world = homeWorld("sunset", { opening: false }); // the sections are the nine scenes; the opening's scroll length is added in front by HomeStory

/**
 * One of the home page's nine sections: it gives the scroll length of its shot and join, and holds the text shown while the camera rests.
 * children: the heading and its first lines (and any link that must stay in reach), shown in the hold's paper panel, labelled `label`.
 * more: the rest of the section. It flows in the page without scripts; while the world runs it is out of sight but still there for screen readers and keyboards.
 */
export default function StorySection({ id, labelledBy, label, anchor, more, children }: { id: string; labelledBy: string; label: string; anchor?: ReactNode; more?: ReactNode; children: ReactNode }) {
  const i = SECTIONS.indexOf(id);
  const style = { "--span": `${spanVh(world, i)}vh` } as CSSProperties;
  return (
    <section data-scene={id} aria-labelledby={labelledBy} className={s.section} style={style}>
      {anchor}
      <div data-hold={`${id}-hold`} data-dock={world.shots[i].holds[0].dock}>
        <HoldPanel label={label} count={`SCENE ${i + 1}`} section={id}>{children}</HoldPanel>
        {more && <div data-rest>{more}</div>}
      </div>
      {TAG_SECTIONS.includes(id) && <div data-tags={id} className={s.tags} />}
      {id === "s5" && <div data-screens="" className={s.tags} />}
      <Names section={id} />
      {id === "s9" &&<div data-signs="" className={s.tags} />}{/* where scene 9's signs are drawn when pinned to the art (outside the transformed hold) */}
    </section>
  );
}
