export const PROTOCOL_VERSION = 1 as const;

export type Button = "up" | "down" | "left" | "right" | "select" | "back" | "home";
export type Stage = "runtime" | "pillow" | "os" | "storage" | "boot";

export type ErrorKind = "unsupported" | "download" | "python";

export type ToWorker =
  | { v: 1; type: "init" }
  | { v: 1; type: "power"; t: number }
  | { v: 1; type: "input"; kind: "press" | "release"; button: Button; t: number }
  | { v: 1; type: "back"; t: number }
  | { v: 1; type: "start"; script: string; t: number }
  | { v: 1; type: "install"; id: string; source: string }
  | { v: 1; type: "reset" };

export type FromWorker =
  | { v: 1; type: "progress"; stage: Stage; pct: number }
  | { v: 1; type: "frame"; bits: ArrayBuffer; full: boolean; screen: string; text: string; saving: boolean; poweredOff: boolean }
  | { v: 1; type: "installed"; error: string | null }
  | { v: 1; type: "resetDone" }
  | { v: 1; type: "error"; kind: ErrorKind; message: string };

/** The `?script=<id>` to start once boot reaches Home, or null. Ids are script folder names. */
export function scriptParam(search: string): string | null {
  const id = new URLSearchParams(search).get("script");
  return id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}
