import type { Button } from "./protocol";

const MAP: Record<string, Button> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "select",
  " ": "select",
  Escape: "back",
  Backspace: "back",
  h: "home",
  H: "home",
};

export function keyToButton(key: string): Button | null {
  return MAP[key] ?? null;
}
