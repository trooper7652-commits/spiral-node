const MAX_URL = 7500;

/** A safe script folder id from a script name. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40).replace(/_+$/, "") || "my_script";
}

/** GitHub "new file" link that opens a pull request for scripts/<id>/script.py, or null when it would be too long for a URL. */
export function submitUrl(repoUrl: string, id: string, source: string): string | null {
  const url = `${repoUrl}/new/main?filename=scripts/${id}/script.py&value=${encodeURIComponent(source)}`;
  return url.length > MAX_URL ? null : url;
}
