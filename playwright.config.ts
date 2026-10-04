import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration (Issue 9 — E2E Integration Testing & Screenshots).
 *
 * - `testDir: ./e2e` — Lab 2 (`e2e/lab-02`) and Lab 3 (`e2e/lab-03`) specs.
 * - `webServer` auto-starts the TokTickIT API (port 3000) and the Vite client
 *   (port 5173) when they are not already running, so `npm run test:e2e` is a
 *   single-command verification. `reuseExistingServer` keeps manual workflows.
 * - Screenshots: every Lab 3 spec explicitly saves full-page captures for the
 *   required review shots to `artifacts/lab-03/screenshots/`, and Playwright
 *   additionally records failure screenshots + traces under `test-results`.
 * - Viewports: Desktop >= 1280px and Mobile < 768px are covered per spec via
 *   `page.setViewportSize()` (queue renders table >= 768px, cards below).
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "artifacts/lab-03/test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    {
      command: "npm --prefix server run dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm --prefix client run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
