import { defineConfig, devices } from "@playwright/test";

const browserPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const browserBaseUrl = `http://127.0.0.1:${browserPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: browserBaseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec next dev --port ${browserPort}`,
    url: browserBaseUrl,
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
