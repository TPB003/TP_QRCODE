import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  // Cloudflare's local Worker and the Vite graph can both cold-start on the
  // first browser flow. Keep assertions strict, but give that first request
  // enough time to finish on a clean machine.
  timeout: 60_000,
  retries: 1,
  workers: 1,
  outputDir: "tmp/test-results",
  reporter: [["list"], ["html", { outputFolder: "tmp/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/start-test-servers.mjs",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium" } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
