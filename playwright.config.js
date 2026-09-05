import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests.
 *
 * DRIVES THE EDGE THAT IS ALREADY INSTALLED rather than downloading Playwright's
 * own Chromium. `npx playwright install` fetches ~150MB and fails outright on a
 * machine without access to Playwright's CDN; every Windows box this project is
 * developed on already has Edge, and it is the same engine. Anyone who prefers
 * the bundled browser can drop the `channel` line after running the install.
 *
 * The dev server is started by the runner and reused if one is already up, so
 * `npx playwright test` works from a clean checkout with nothing else running.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results",

  use: {
    baseURL: "http://localhost:5199",
    channel: "msedge",
    // A trace on the first retry, so a failure that only happens in CI is still
    // explicable without reproducing it locally.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } } },
  ],

  webServer: {
    command: "npm run dev -- --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
