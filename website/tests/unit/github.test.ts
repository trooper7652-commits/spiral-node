import { describe, expect, it } from "vitest";
import { fetchRepoStats } from "../../lib/github";

const API = "https://api.github.com/repos/o/r";
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const fake = (repo: Response | Error, people: Response | Error) =>
  (async (url: string) => {
    const r = String(url).includes("/contributors") ? people : repo;
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
const ada = { login: "ada", avatar_url: "https://avatars.githubusercontent.com/u/1", html_url: "https://github.com/ada" };

describe("fetchRepoStats", () => {
  it("reads the star count and human contributors, without bots", async () => {
    const bot = { login: "dependabot[bot]", avatar_url: "https://avatars.githubusercontent.com/u/2", html_url: "https://github.com/apps/dependabot" };
    const s = await fetchRepoStats(API, fake(res(200, { stargazers_count: 42 }), res(200, [ada, bot])));
    expect(s).toEqual({ stars: 42, contributors: [{ login: "ada", avatar: ada.avatar_url, url: ada.html_url }] });
  });
  it("rate limited (403): stars null, no contributors", async () => {
    const limited = () => res(403, { message: "API rate limit exceeded" });
    expect(await fetchRepoStats(API, fake(limited(), limited()))).toEqual({ stars: null, contributors: [] });
  });
  it("offline: stars null, no contributors", async () => {
    const off = () => new TypeError("Failed to fetch");
    expect(await fetchRepoStats(API, fake(off(), off()))).toEqual({ stars: null, contributors: [] });
  });
  it("an empty repo (contributors 204, no body) keeps its star count", async () => {
    expect(await fetchRepoStats(API, fake(res(200, { stargazers_count: 0 }), new Response(null, { status: 204 })))).toEqual({ stars: 0, contributors: [] });
  });
  it("drops entries whose links are not GitHub's", async () => {
    const odd = { login: "x", avatar_url: "https://evil.example/a.png", html_url: "javascript:alert(1)" };
    expect((await fetchRepoStats(API, fake(res(200, {}), res(200, [odd, ada])))).contributors).toEqual([{ login: "ada", avatar: ada.avatar_url, url: ada.html_url }]);
  });
});
