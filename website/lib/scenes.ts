export type Scene = "night" | "sunset";

/** Wait before the next slide, in ms: fresh draw in [3000, 8000). */
export const nextWait = (rand: () => number = Math.random) => 3000 + rand() * 5000;

/** Both modes start on sunset; reduced motion simply never auto-slides. */
export const initialScene = (_reduced: boolean): Scene => "sunset";

export const other = (scene: Scene): Scene => (scene === "sunset" ? "night" : "sunset");
