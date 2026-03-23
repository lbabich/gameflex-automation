import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  testMatch: '**/*.spec.ts',
  timeout: 600_000,
  workers: 2,
  reporter: 'list',
  use: {
    headless: false,
    screenshot: 'only-on-failure',
    httpCredentials:
      process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
        ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
        : undefined,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
