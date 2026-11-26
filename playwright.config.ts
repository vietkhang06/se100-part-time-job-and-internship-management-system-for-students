import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Smoke Test Configuration for CampusJob M05 (S8-M05-02).
 * Run:
 *   pnpm exec playwright test --config playwright.config.ts
 */
export default defineConfig({
  testDir: './apps/web/tests/smoke',
  testMatch: /.*\.smoke\.spec\.ts/,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro 11'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: 'pnpm dev:web',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
