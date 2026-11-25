/** The live star count: one request; null when GitHub is rate-limited, offline or answers oddly. */
export async function fetchStars(api: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  try {
    const r = await fetchFn(api, { headers: { Accept: "application/vnd.github+json" } });
    const stars = r.ok ? ((await r.json()) as { stargazers_count?: unknown } | null)?.stargazers_count : null;
    return typeof stars === "number" ? stars : null;
  } catch {
    return null; // offline, or a body that is not JSON
  }
}
