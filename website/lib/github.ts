export type Contributor = { login: string; avatar: string; url: string };
export type RepoStats = { stars: number | null; contributors: Contributor[] };

async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
  try {
    const r = await fetchFn(url, { headers: { Accept: "application/vnd.github+json" } });
    return r.ok ? await r.json() : null; // 403 rate limit, 404, or 204 (empty repo: json() throws) → null
  } catch {
    return null; // offline
  }
}

type ApiPerson = { login?: unknown; avatar_url?: unknown; html_url?: unknown };
const human = (p: ApiPerson): p is { login: string; avatar_url: string; html_url: string } =>
  typeof p?.login === "string" &&
  !p.login.endsWith("[bot]") &&
  typeof p.avatar_url === "string" &&
  p.avatar_url.startsWith("https://avatars.githubusercontent.com/") &&
  typeof p.html_url === "string" &&
  p.html_url.startsWith("https://github.com/");

/** Live star count and human contributors; each falls back on its own (null / []) when GitHub is rate-limited or offline. */
export async function fetchRepoStats(api: string, fetchFn: typeof fetch = fetch): Promise<RepoStats> {
  const [repo, people] = await Promise.all([getJson(api, fetchFn), getJson(`${api}/contributors?per_page=100`, fetchFn)]);
  const stars = (repo as { stargazers_count?: unknown } | null)?.stargazers_count;
  return {
    stars: typeof stars === "number" ? stars : null,
    contributors: Array.isArray(people)
      ? people.filter(human).map((p) => ({ login: p.login, avatar: p.avatar_url, url: p.html_url }))
      : [],
  };
}
