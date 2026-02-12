import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4173);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT: "http://127.0.0.1:9",
      NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE: "false",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
