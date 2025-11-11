import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60000, // Increased from 30000 for complex scene tests
  expect: {
    timeout: 5000
  },
  retries: 1, // Retry failed tests once
  workers: 1, // Reduced to 1 to eliminate all parallelization issues
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://localhost:3000',
    actionTimeout: 0,
    // keep the desktop chrome device settings
    ...devices['Desktop Chrome']
  },
  webServer: {
    // serve the built app (build/) which contains the generated index.html and bundle
    command: 'npx http-server -c-1 -p 3000 build',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});