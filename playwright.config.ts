import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // The public stand is shared: at most four workers anywhere, and no more than half of the local cores.
  workers: isCI ? 4 : Math.min(4, Math.ceil(os.availableParallelism() / 2)),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Written at the end of the run, so it survives the cleanup of outputDir; read by the failure-demo gate in CI.
    ['json', { outputFile: 'test-results/report.json' }],
  ],
  use: {
    baseURL: env.BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    // Fails within seconds, naming the address and the response code, when the stand is unreachable.
    { name: 'setup', testDir: 'tests/setup', testMatch: /\.setup\.ts$/ },
    {
      name: 'chromium',
      testDir: 'tests/ui',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    { name: 'api', testDir: 'tests/api', dependencies: ['setup'] },
  ],
});
