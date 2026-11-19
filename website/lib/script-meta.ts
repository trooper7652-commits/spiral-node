/** A string constant from script.py, e.g. NAME = "Connect". shortcut: no escaped quotes inside; fine for one-line names. Client-safe. */
export function constant(src: string, key: string): string | undefined {
  return src.match(new RegExp(`^${key}\\s*=\\s*(["'])(.*?)\\1`, "m"))?.[2];
}
