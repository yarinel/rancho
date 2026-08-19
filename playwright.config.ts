import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build (next build && next start) so CI
 * verifies what actually ships. Mobile-first: the primary project is a
 * mobile viewport, matching the product's mobile-first requirement.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // fresh e2e database every run — deterministic scenarios
    command: "rm -rf .data/pglite-e2e && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // e2e-only secret; real deployments must set their own AUTH_SECRET
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-not-for-production",
      PGLITE_DIR: process.env.PGLITE_DIR ?? ".data/pglite-e2e",
    },
  },
});
