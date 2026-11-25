import type { World, Shot, Transition, Key } from "./types";

const k = (at: number, x: number, y: number): Key => ({ at, cam: { x, y, zoom: 1, rot: 0 } });

const art = (scene: string) => ({ wide: `/world/${scene}/wide/manifest.json`, tall: `/world/${scene}/tall/manifest.json` });

/** A shot rests at (rx, ry) (the centre unless the art needs the panel clear of something) until `to`, then drifts by (dx, dy) to its end. Every key is at zoom 1: the zoom belongs to the joins. */
const keys = (to: number, dx: number, dy: number, rx = 0.5, ry = 0.5): Key[] => [k(0, rx, ry), k(to, rx, ry), k(1, rx + dx, ry + dy)];

export const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];

/** The opening: the device on paper, no panel. Its screen plays on over the shot; the join then pushes through the screen into scene 1. */
export const OPENING_SHOT: Shot = {
  id: "s0",
  art: art("opening"),
  lengthVh: 240,
  keys: keys(0.6, 0.02, 0.01),
  holds: [],
};
export const OPENING_JOIN: Transition = { kind: "through", lengthVh: 150, params: { a: "screen" } };

export function spanVh(world: World, i: number) {
  return world.shots[i].lengthVh + (world.joins[i]?.lengthVh ?? 0);
}

/** opening: put the opening (shot s0) in front of scene 1. Without it the world is the nine scenes and eight joins. */
export function homeWorld(sky: "sunset" | "night", { opening }: { opening: boolean }): World {
  const shots: Shot[] = [
    {
      id: "s1",
      art: art(`countryside-${sky}`),
      lengthVh: 320,
      keys: keys(0.45, 0.06, 0.02),
      // from < 0: the title is fully shown at the top of the page
      holds: [{ id: "s1-hold", from: -0.15, to: 0.45, dock: "left" }],
    },
    {
      id: "s2",
      art: art("desk"),
      lengthVh: 340,
      // rests near the top of the art, so the figure sits lower and the left panel clears their head
      keys: keys(0.5, -0.04, 0, 0.5, 0.15),
      holds: [{ id: "s2-hold", from: 0.08, to: 0.5, dock: "left" }],
    },
    {
      id: "s3",
      art: art("shell"),
      lengthVh: 380,
      keys: keys(0.72, 0.04, -0.02),
      holds: [{ id: "s3-hold", from: 0.15, to: 0.72, dock: "right" }],
    },
    {
      id: "s4",
      art: art("device"),
      lengthVh: 360,
      keys: keys(0.85, -0.04, 0.02),
      holds: [{ id: "s4-hold", from: 0.3, to: 0.85, dock: "left" }],
    },
    {
      id: "s5",
      art: art("scroll"),
      lengthVh: 400,
      keys: keys(0.75, 0.04, 0),
      holds: [{ id: "s5-hold", from: 0.12, to: 0.75, dock: "right" }],
    },
    {
      id: "s6",
      art: art("map"),
      lengthVh: 400,
      // rests a little left and high, so the roadmap tags lie right of and below the left panel
      keys: keys(0.7, -0.04, -0.02, 0.47, 0.4),
      holds: [{ id: "s6-hold", from: 0.12, to: 0.7, dock: "left" }],
    },
    {
      id: "s7",
      art: art("atlas"),
      lengthVh: 600,
      // the exit pans down toward the falling star, so the camera follows the light
      keys: keys(0.9, 0.02, 0.08),
      holds: [{ id: "s7-hold", from: 0.08, to: 0.9, dock: "right" }],
    },
    {
      id: "s8",
      art: art("square"),
      lengthVh: 380,
      // the exit pans up toward the lantern above the rooftops
      keys: keys(0.72, 0.03, -0.1),
      holds: [{ id: "s8-hold", from: 0.15, to: 0.72, dock: "left" }],
    },
    {
      id: "s9",
      art: art("hill"),
      lengthVh: 340,
      // rests a little left of centre, so the gate's left post clears the left panel and the signs can hang between the posts on a 1280 px laptop
      keys: [k(0, 0.46, 0.5), k(1, 0.46, 0.5)],
      // to > 1: "Want one?" never fades before the footer
      holds: [{ id: "s9-hold", from: 0.3, to: 1.25, dock: "left" }],
    },
  ];

  // a, b: the anchors each side of the join aims at (named in the scenes' manifests)
  const joins: Transition[] = [
    { kind: "through", lengthVh: 150, params: { a: "slate" } },
    { kind: "ink", lengthVh: 150, params: { a: "sketch_shell", b: "spiral" } }, // the page's sketch of the shell, zoomed onto scene 3's shell
    { kind: "match", lengthVh: 140, params: { a: "spiral", b: "wheel" } },
    { kind: "curl", lengthVh: 150, params: {} },
    { kind: "match", lengthVh: 140, params: { a: "roller", b: "map" } },
    { kind: "nightfall", lengthVh: 150, params: { lights: 12 } },
    { kind: "light", lengthVh: 160, params: { a: "star", b: "lantern" } },
    { kind: "light", lengthVh: 150, params: { a: "lantern_up", b: "sun" } },
  ];

  return opening ? { shots: [OPENING_SHOT, ...shots], joins: [OPENING_JOIN, ...joins] } : { shots, joins };
}
