// Proves the real OS runs in Pyodide (Node, MEMFS). Needs `npm run predev` output in public/.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pub = resolve(__dirname, "../../public");

describe("OS in Pyodide", () => {
  it("boots to home", async () => {
    const t0 = Date.now();
    const { loadPyodide } = await import("pyodide");
    const py = await loadPyodide({ indexURL: resolve(pub, "pyodide") });
    const wheel = readdirSync(resolve(pub, "pyodide")).find((f) => f.startsWith("pillow") && f.endsWith(".whl"))!;
    await py.loadPackage(resolve(pub, "pyodide", wheel));
    const t1 = Date.now();
    py.unpackArchive(new Uint8Array(readFileSync(resolve(pub, "spiral-os.zip"))), "zip", { extractDir: "/os" });
    py.runPython("import sys; sys.path.insert(0, '/os')");
    py.FS.mkdirTree("/tmp/data");
    const host = py.runPython("from spiral.web import WebHost\nh = WebHost(data_dir='/tmp/data')\nh") as any;
    host.power_on(0);
    let last: any = null;
    for (let t = 0; t <= 4000; t += 20) {
      const r = host.tick(t);
      if (r) {
        if (last) last.destroy?.();
        last = r;
      }
    }
    const f = last.toJs({ dict_converter: Object.fromEntries });
    console.log(`pyodide load ${t1 - t0} ms, os+boot ${Date.now() - t1} ms, python ${py.runPython("import sys; sys.version")}`);
    expect(f.screen).toBe("home");
    expect(f.bits.length).toBe(3904);
  }, 60000);
});
