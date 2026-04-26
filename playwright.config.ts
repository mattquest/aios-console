import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config. The dev server auto-starts on port 3100 to avoid
 * colliding with a user's local ``next dev`` on 3000. AIOS_URL is set
 * to an unreachable port: the proxy routes never fire because the tests
 * intercept ``/api/aios/**`` at the Playwright layer instead, so no real
 * aios backend is required.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // ``next start`` rather than ``next dev`` because Next's dev server has
  // a single-instance lock — if the developer is already running
  // ``pnpm dev`` on 3000, a second ``next dev`` refuses to start and
  // playwright just sees ERR_CONNECTION_REFUSED. ``next start`` has no
  // such lock and matches the production runtime we actually ship.
  webServer: {
    command: "pnpm build && pnpm start --port 3100",
    port: 3100,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Deliberately unreachable but NOT a "bad port" (fetch blocks
      // 1..21, 1080 etc.). 49152 is a valid ephemeral port that
      // nobody'll be listening on in a test run.
      AIOS_URL: "http://127.0.0.1:49152",
      AIOS_API_KEY: "test-key",
    },
  },
});
