import StorySection from "@/components/story/StorySection";
import CommunitySpotlight from "@/components/CommunitySpotlight";
import { homeWorld } from "@/lib/world/home";
import type { CSSProperties } from "react";
import styles from "./sections.module.css";

const shot = homeWorld("sunset", { opening: false }).shots[7];
const hold = shot.holds[0];
// /#community lands on the middle of the hold, where the text is shown
const at = `${((hold.from + hold.to) / 2) * shot.lengthVh}vh`;

export default function SceneCommunity() {
  return (
    <StorySection
      id="s8"
      labelledBy="community-h"
      label="Join in"
      anchor={<span id="community" className={styles.anchor} style={{ "--at": at } as CSSProperties} />}
      more={<CommunitySpotlight />}
    >
      <h2 id="community-h">Community</h2>
      <p>For visionaries, artisans, crafters, makers, doers, designers, innovators and operators who love thinking. Scripts are plain Python, so anyone can write one and share it.</p>
    </StorySection>
  );
}
