import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30000, // 30 seconds per test max
  expect: {
    timeout: 5000
  },
  retries: process.env.CI ? 2 : 1, // More retries in CI for flaky tests
  workers: 1, // Reduced to 1 to eliminate all parallelization issues
  reporter: process.env.CI ? 'github' : 'html', // GitHub Actions reporter in CI
  globalTimeout: process.env.CI ? 600000 : undefined, // 10 minute global timeout in CI
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://localhost:8000',
    actionTimeout: 0,
    // keep the desktop chrome device settings
    ...devices['Desktop Chrome']
  },
  webServer: {
    // serve the built app (build/) which contains the generated index.html and bundle
    command: 'npx http-server -c-1 -p 8000 build',
    port: 8000,
    timeout: 120_000,
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});