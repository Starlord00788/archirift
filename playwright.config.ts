import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the static export, exactly as it will be hosted.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/serve-out.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
