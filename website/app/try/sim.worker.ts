/// <reference lib="webworker" />
import type { Button, ErrorKind, FromWorker, Stage, ToWorker } from "../../lib/sim/protocol";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);
const progress = (stage: Stage, pct: number) => post({ v: 1, type: "progress", stage, pct });

let py: any;
let host: any;
let timer: ReturnType<typeof setInterval> | undefined;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let backTimer: ReturnType<typeof setTimeout> | undefined;

// The page's `t` is ignored on purpose: page and worker performance.now() clocks have different
// origins. Long-press (Back) timing is measured by WebHost ticks against this worker's clock,
// so every host call uses the worker's own performance.now() at receipt.
const now = () => performance.now();

function describe(e: unknown): string {
  const s = String((e as any)?.stack ?? (e as any)?.message ?? e).trim();
  const lines = s.split("\n").filter(Boolean);
  return lines.length > 1 ? `${lines[0]} ... ${lines[lines.length - 1]}` : (lines[0] ?? "Unknown error");
}

const syncfs = (populate: boolean) =>
  new Promise<void>((res, rej) => py.FS.syncfs(populate, (err: unknown) => (err ? rej(err) : res())));

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncfs(false).catch(fail), 300);
}

function stop() {
  clearInterval(timer);
  timer = undefined;
  clearTimeout(backTimer);
}

function fail(e: unknown) {
  stop();
  post({ v: 1, type: "error", kind: (e as any)?.kind ?? "python", message: describe(e) });
}

/** Runs one init step; any failure is tagged with the kind the page maps to a message. */
async function step<T>(kind: ErrorKind, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { kind });
  }
}

async function init() {
  if (typeof WebAssembly === "undefined") throw Object.assign(new Error("This browser has no WebAssembly support."), { kind: "unsupported" });
  if (typeof indexedDB === "undefined") throw Object.assign(new Error("This browser has no IndexedDB, so the device cannot save."), { kind: "unsupported" });
  progress("runtime", 0);
  const { loadPyodide } = await step("download", () => import(/* webpackIgnore: true */ "/pyodide/pyodide.mjs" as string));
  py = await step("download", () => loadPyodide({ indexURL: "/pyodide/" }));
  progress("pillow", 0);
  await step("download", () => py.loadPackage("pillow"));
  progress("os", 0);
  const zip = await step("download", async () => {
    const res = await fetch("/spiral-os.zip");
    if (!res.ok) throw new Error(`Could not download the OS (${res.status}).`);
    return res.arrayBuffer();
  });
  py.unpackArchive(zip, "zip", { extractDir: "/os" });
  py.runPython("import sys; sys.path.insert(0, '/os')");
  progress("storage", 0);
  py.FS.mkdirTree("/data");
  py.FS.mount(py.FS.filesystems.IDBFS, {}, "/data");
  await syncfs(true);
  progress("boot", 0);
  host = py.runPython("from spiral.web import WebHost\nWebHost(data_dir='/data')");
  progress("boot", 100);
}

function tick() {
  try {
    const r = host.tick(now());
    if (r) {
      const f = r.toJs({ dict_converter: Object.fromEntries });
      r.destroy();
      const bits = new Uint8Array(f.bits).buffer; // copy into a fresh, transferable buffer
      post({ v: 1, type: "frame", bits, full: !!f.full, screen: f.screen, text: f.text, saving: !!f.saving, poweredOff: !!f.powered_off }, [bits]);
    }
    if (host.flushed_since_last_call()) scheduleSync();
  } catch (e) {
    fail(e);
  }
}

async function handle(m: ToWorker) {
  switch (m.type) {
    case "init":
      await init();
      break;
    case "power":
      host.power_on(now());
      if (!timer) timer = setInterval(tick, 20);
      break;
    case "input":
      host[m.kind](m.button as Button, now());
      break;
    case "back": {
      if (backTimer) {
        clearTimeout(backTimer);
        host.release("select", now()); // finish the previous press before starting a new one
      }
      const t = now();
      host.press("select", t);
      backTimer = setTimeout(() => {
        backTimer = undefined;
        try {
          host.release("select", t + 650);
        } catch (e) {
          fail(e);
        }
      }, 650);
      break;
    }
    case "start":
      host.start(m.script, now());
      break;
    case "install": {
      const error = host.install_script(m.id, m.source) ?? null;
      post({ v: 1, type: "installed", error });
      scheduleSync();
      break;
    }
    case "reset":
      stop();
      host.reset();
      await syncfs(false);
      post({ v: 1, type: "resetDone" }); // the page can show power-on again
      break;
  }
}

// Messages run one at a time, so `power` waits for `init` to finish.
let queue: Promise<void> = Promise.resolve();
ctx.onmessage = (ev: MessageEvent<ToWorker>) => {
  if (ev.data?.v !== 1) return;
  queue = queue.then(() => handle(ev.data)).catch(fail);
};
