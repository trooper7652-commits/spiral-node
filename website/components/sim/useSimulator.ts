"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { unpackFrame } from "@/lib/sim/bits";
import { scriptParam, type Button, type ErrorKind, type FromWorker, type Stage } from "@/lib/sim/protocol";

export type Frame = {
  pixels: Uint8Array;
  full: boolean;
  screen: string;
  text: string;
  saving: boolean;
  poweredOff: boolean;
  seq: number;
};
export type Phase =
  | { kind: "off" }
  | { kind: "loading"; stage: Stage }
  | { kind: "running" }
  | { kind: "error"; message: string; detail: string };

/** Maps a worker failure to one of the three messages in the copy deck. */
function explain(kind: ErrorKind): string {
  if (kind === "unsupported") return "This browser can't run the simulator (it needs WebAssembly and IndexedDB).";
  if (kind === "download") return "Download failed.";
  return "Spiral OS hit an error.";
}

/** Owns the worker and the off -> loading -> running -> error state machine. */
export function useSimulator() {
  const [phase, setPhase] = useState<Phase>({ kind: "off" });
  const [frame, setFrame] = useState<Frame | null>(null);
  const [pressed, setPressed] = useState<ReadonlySet<Button>>(new Set());
  const worker = useRef<Worker | null>(null);
  const resetting = useRef(false);
  const seq = useRef(0);
  const sources = useRef(new Map<Button, Set<string>>());
  const running = useRef(false);
  const installs = useRef<((error: string | null) => void)[]>([]); // pending run() calls, answered in order
  const lastScreen = useRef<string | null>(null);
  const startScript = useRef<string | null>(null); // from /try?script=<id>, sent once Home is reached

  const send = useCallback((m: object) => worker.current?.postMessage({ v: 1, ...m }), []);

  const fail = useCallback((detail: string, kind: ErrorKind = "python") => {
    worker.current?.terminate();
    worker.current = null;
    running.current = false;
    resetting.current = false;
    sources.current.clear();
    setPressed(new Set());
    installs.current.splice(0).forEach((done) => done(detail));
    setPhase({ kind: "error", message: explain(kind), detail });
  }, []);

  const spawn = useCallback(() => {
    worker.current?.terminate();
    if (typeof WebAssembly === "undefined" || typeof indexedDB === "undefined") {
      fail("This browser has no WebAssembly or IndexedDB.", "unsupported");
      return;
    }
    const w = new Worker(new URL("../../app/try/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.type === "progress") {
        if (!resetting.current) setPhase((p) => (p.kind === "loading" ? { kind: "loading", stage: m.stage } : p));
      } else if (m.type === "resetDone") {
        resetting.current = false; // the worker has erased the data: show the off device again
        setFrame(null);
        setPhase({ kind: "off" });
      } else if (m.type === "frame") {
        if (resetting.current) return;
        running.current = true;
        lastScreen.current = m.screen;
        setFrame({ ...m, pixels: unpackFrame(new Uint8Array(m.bits)), seq: ++seq.current });
        setPhase((p) => (p.kind === "running" ? p : { kind: "running" }));
        if (m.screen === "home" && startScript.current) {
          send({ type: "start", script: startScript.current, t: performance.now() });
          startScript.current = null;
        }
      } else if (m.type === "installed") installs.current.shift()?.(m.error);
      else if (m.type === "error") fail(m.message, m.kind);
    };
    w.onerror = (e) => fail(e.message || "Worker failed to load");
    startScript.current = scriptParam(window.location.search);
    send({ type: "init" });
  }, [fail, send]);

  const powerOn = useCallback(() => {
    if (!worker.current) spawn();
    if (!worker.current) return;
    setPhase((p) => (p.kind === "running" ? p : { kind: "loading", stage: "runtime" }));
    send({ type: "power", t: performance.now() });
  }, [send, spawn]);

  /** Power on if needed, install a script and start it (right away, or once boot reaches Home). */
  const run = useCallback(
    (id: string, source: string) =>
      new Promise<string | null>((resolve) => {
        installs.current.push((error) => {
          if (!error) {
            if (lastScreen.current && lastScreen.current !== "boot") send({ type: "start", script: id, t: performance.now() });
            else startScript.current = id;
          }
          resolve(error);
        });
        powerOn();
        send({ type: "install", id, source });
      }),
    [powerOn, send],
  );

  const tryAgain = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    running.current = false;
    resetting.current = false;
    sources.current.clear();
    setPressed(new Set());
    setFrame(null);
    setPhase({ kind: "loading", stage: "runtime" });
    spawn();
    send({ type: "power", t: performance.now() });
  }, [send, spawn]);

  const releaseAll = useCallback(() => {
    for (const b of sources.current.keys()) send({ type: "input", kind: "release", button: b, t: performance.now() });
    sources.current.clear();
    setPressed(new Set());
  }, [send]);

  const reset = useCallback(() => {
    releaseAll();
    running.current = false;
    resetting.current = true;
    send({ type: "reset" });
  }, [releaseAll, send]);

  /** One press per button however many sources (pointer, Enter, Space) hold it. */
  const press = useCallback(
    (b: Button, src: string) => {
      if (!running.current) return;
      const set = sources.current.get(b) ?? new Set<string>();
      const first = set.size === 0;
      set.add(src);
      sources.current.set(b, set);
      if (!first) return;
      send({ type: "input", kind: "press", button: b, t: performance.now() });
      setPressed(new Set(sources.current.keys()));
    },
    [send],
  );
  const release = useCallback(
    (b: Button, src: string) => {
      const set = sources.current.get(b);
      if (!set?.delete(src) || set.size) return;
      sources.current.delete(b);
      send({ type: "input", kind: "release", button: b, t: performance.now() });
      setPressed(new Set(sources.current.keys()));
    },
    [send],
  );
  const back = useCallback(() => running.current && send({ type: "back", t: performance.now() }), [send]);

  useEffect(() => () => worker.current?.terminate(), []);

  return { phase, frame, pressed, powerOn, run, tryAgain, reset, press, release, back, releaseAll, hasWorker: () => !!worker.current };
}
