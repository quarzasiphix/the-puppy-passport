import { defineConfig, devices } from "@playwright/test";

// E2E tests assume the local Supabase stack is already running with seed data
// (`npm run db:start` — see docs/LOCAL_SETUP.md for demo accounts). They do NOT start or reset
// the database themselves, since resetting would wipe demo accounts other tests/developers rely
// on. See docs/E2E_TESTING.md for the full local/CI setup.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // several specs sign in as the same shared demo accounts; parallel runs
  // would race each other's session state (cookies) against one dev server.
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Run with `npm run test:e2e:mobile` — a real device profile (viewport + touch + UA), not
    // just a resized desktop window, so tap-target and layout regressions are caught for real.
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // @lovable.dev/vite-tanstack-config pins the dev server to port 8080 (strictPort) outside
        // this sandbox. This session's port 8080 happened to be occupied by something else, which
        // is why `npm run dev` fell back to 8081 here — that fallback is sandbox-specific, not the
        // real default, so tests target 8080. Override with E2E_BASE_URL if that's ever wrong.
        command: "npm run dev",
        url: "http://127.0.0.1:8080",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
