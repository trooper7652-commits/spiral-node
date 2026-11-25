import type { Metadata } from "next";
import HomeStory from "@/components/story/HomeStory";
import SceneOne from "@/components/story/sections/SceneOne";
import ScenePurpose from "@/components/story/sections/ScenePurpose";
import SceneFeatures from "@/components/story/sections/SceneFeatures";
import SceneDesign from "@/components/story/sections/SceneDesign";
import SceneScripts from "@/components/story/sections/SceneScripts";
import SceneRoadmap from "@/components/story/sections/SceneRoadmap";
import SceneQuestions from "@/components/story/sections/SceneQuestions";
import SceneCommunity from "@/components/story/sections/SceneCommunity";
import SceneExplore from "@/components/story/sections/SceneExplore";
import { og } from "@/lib/meta";

export const metadata: Metadata = og(
  "home",
  "Spiral Node by Helix Velocities",
  "A pocket e-ink device that hands you ideas and leaves the thinking to you. Offline. Open source.",
);

export default function HomePage() {
  return (
    <HomeStory>
      <SceneOne />
      <ScenePurpose />
      <SceneFeatures />
      <SceneDesign />
      <SceneScripts />
      <SceneRoadmap />
      <SceneQuestions />
      <SceneCommunity />
      <SceneExplore />
    </HomeStory>
  );
}
