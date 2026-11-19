import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { constant } from "./script-meta";

export { constant };

export type ScriptCard = { id: string; name: string; description: string; author: string; community: boolean };

// read at build time; the site builds from website/, next to os/ and scripts/
const BUILTIN = join(process.cwd(), "../os/spiral/builtin_scripts");
const COMMUNITY = join(process.cwd(), "../scripts");

function read(dir: string, community: boolean): ScriptCard[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "TEMPLATE" && existsSync(join(dir, d.name, "script.py")))
    .map((d) => {
      const src = readFileSync(join(dir, d.name, "script.py"), "utf8");
      return {
        id: d.name,
        name: constant(src, "NAME") ?? d.name,
        description: constant(src, "DESCRIPTION") ?? "",
        author: constant(src, "AUTHOR") ?? "Spiral Node",
        community,
      };
    });
}

/** Every script the simulator can run: built-ins first, then community scripts, each sorted by name. */
export function listScripts(): ScriptCard[] {
  const byName = (a: ScriptCard, b: ScriptCard) => a.name.localeCompare(b.name);
  return [...read(BUILTIN, false).sort(byName), ...read(COMMUNITY, true).sort(byName)];
}

export function getScript(id: string): ScriptCard | undefined {
  return listScripts().find((s) => s.id === id);
}
