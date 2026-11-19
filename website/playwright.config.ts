import { defineConfig } from "@playwright/test";

// E2E_PORT changes the port (default 3100).
const port = process.env.E2E_PORT ?? "3100";

// @playwright/test 1.63 bundles the same Chromium (1243) that is pre-installed in /opt/pw-browsers.
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: `http://localhost:${port}`, trace: "off" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
