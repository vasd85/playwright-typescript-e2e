import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { ALLURE_RESULTS_DIR } from './src/config/global-setup';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  globalSetup: './src/config/global-setup.ts',
  // Strips credentials from failure traces before the reporters copy them; see src/config/global-teardown.ts.
  globalTeardown: './src/config/global-teardown.ts',
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
    // Written at the end of the run, so it survives the cleanup of outputDir.
    ['json', { outputFile: 'test-results/report.json' }],
    // Writes one result file per test; `npm run report:allure` builds the report from them.
    // A static annotation `issue`/`tms` becomes a link by these templates.
    [
      'allure-playwright',
      {
        resultsDir: ALLURE_RESULTS_DIR,
        links: {
          issue: { urlTemplate: 'https://github.com/vasd85/playwright-typescript-e2e/issues/%s' },
          // No test management system belongs to this repository: a reserved example domain.
          tms: { urlTemplate: 'https://tms.example.com/case/%s', nameTemplate: 'Test case %s' },
        },
        environmentInfo: {
          BASE_URL: env.BASE_URL,
          API_URL: env.API_URL,
          node: process.version,
        },
      },
    ],
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
    // `chromium` is a scheduling dependency, not a data one: the runner starts a project only once
    // every dependency finished, which keeps these tests out of the seconds in which the browser
    // registration scenario issues its tokens. Sharing a second there would hand both the same
    // token and silently move one of them into the other's session.
    // The timeout is the project's own: registering a disposable account waits for the second
    // reserved for the slot and then for the stand's clock to pass it, and a worker fixture spends
    // that time inside the first test of the worker.
    {
      name: 'api',
      testDir: 'tests/api',
      dependencies: ['setup', 'chromium'],
      timeout: 60_000,
    },
    // Checks of the framework itself: no browser and no stand, so they run even when the stand is down.
    // Deterministic by construction, hence no retries even in CI.
    { name: 'unit', testDir: 'tests/unit', retries: 0 },
  ],
});
