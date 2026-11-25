import { defineConfig } from "@playwright/test";

// E2E_PORT changes the port (default 3111). A fresh build every run: a server left over on the port would test old code.
const port = process.env.E2E_PORT ?? "3111";

// @playwright/test 1.63 bundles the same Chromium (1243) that is pre-installed in /opt/pw-browsers.
export default defineConfig({
  testDir: "tests/e2e",
  // Every test starts as a returning visitor: the home page's opening (lib/opening.ts, key sn-opened) has been seen, so the world is the nine scenes,
  // and the welcome popup (lib/welcome.ts, key sn-welcome) has been skipped, so no modal stops a test at scene 2. opening.spec.ts and popup.spec.ts start fresh.
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    storageState: {
      cookies: [],
      origins: [{ origin: `http://localhost:${port}`, localStorage: [{ name: "sn-opened", value: "1" }, { name: "sn-welcome", value: "skipped" }] }],
    },
  },
  projects: [
    { name: "chromium", testIgnore: /world-.*\.spec\.ts/, use: { browserName: "chromium" } },
    // The world specs time first frames on a software-rendered canvas; run after the rest, the suite's start-up load cannot starve them (add --no-deps to run one alone).
    { name: "world", testMatch: /world-.*\.spec\.ts/, dependencies: ["chromium"], use: { browserName: "chromium" } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
