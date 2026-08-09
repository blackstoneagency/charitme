import { defineConfig, devices } from '@playwright/test';

// Opt-in browser override for sandboxes that ship a Chromium build older than
// the one this Playwright version expects. Unset (CI, local dev with a normal
// `playwright install`) this is a no-op and Playwright resolves browsers as
// usual; set, it launches the provided binary instead of downloading one.
// Example: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

// When PLAYWRIGHT_BASE_URL points at an already-deployed target (a Vercel preview,
// staging, production), starting a local server is pointless — and it fails unless
// the local environment happens to carry a full Supabase config. Booting one anyway
// meant the suite could not be pointed at a real deployment at all, which is
// exactly what you want when CI compute is unavailable or when verifying a preview
// with real environment variables.
const externalTarget = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: process.env.CI ? 4 : 1,
  ...(externalTarget
    ? {}
    : {
        webServer: {
          command: 'npm start',
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
  use: {
    baseURL: externalTarget ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 5'], launchOptions } },
  ],
});
