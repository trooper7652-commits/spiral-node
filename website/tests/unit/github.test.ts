import { describe, expect, test, vi } from "vitest";
import { fetchStars } from "../../lib/github";

describe("fetchStars", () => {
  test("200 with stargazers_count returns count", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 42 }),
    });
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBe(42);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/x/y", { headers: { Accept: "application/vnd.github+json" } });
  });

  test("403 returns null", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "API rate limit exceeded" }),
    });
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBeNull();
  });

  test("fetch throws returns null", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBeNull();
  });

  test("200 with empty json returns null", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBeNull();
  });

  test("200 with non-number stargazers_count returns null", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: "7" }),
    });
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBeNull();
  });

  test("200 with non-JSON body returns null", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Not JSON")),
    });
    const result = await fetchStars("https://api.github.com/repos/x/y", fetch);
    expect(result).toBeNull();
  });
});
