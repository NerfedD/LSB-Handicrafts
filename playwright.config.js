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
  // One worker. `fullyParallel: false` only serialises WITHIN a file; a second
  // worker runs a second spec file against the same dev server at the same
  // time, and the suite's stubs and sign-in fixtures are not built to be shared
  // that way -- 57 of 94 tests failed on two workers, and the run was slower
  // (7.7m) than serial (3.5m) because each worker also starts its own Edge.
  workers: 1,
  // On installed Edge, cold Vite chunks exceeded the default 5s assertion
  // window in audit traces while the page correctly showed its loading state.
  timeout: 60_000,
  expect: { timeout: 15_000 },
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
