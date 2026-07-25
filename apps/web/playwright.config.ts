import { defineConfig, devices } from '@playwright/test';

// Opt-in browser override for sandboxes that ship a Chromium build older than
// the one this Playwright version expects. Unset (CI, local dev with a normal
// `playwright install`) this is a no-op and Playwright resolves browsers as
// usual; set, it launches the provided binary instead of downloading one.
// Example: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 5'], launchOptions } },
  ],
});
