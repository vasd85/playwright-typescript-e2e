import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { ALLURE_RESULTS_DIR } from './src/config/global-setup';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  // Clears the allure results of the previous run; see src/config/global-setup.ts.
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
    // Written at the end of the run, so it survives the cleanup of outputDir: a machine-readable outcome for CI gates.
    ['json', { outputFile: 'test-results/report.json' }],
    // Writes one result file per test; the report itself is built by `npm run report:allure`
    // from allurerc.mjs. A static annotation `issue`/`tms` of a test becomes a link by these
    // templates, and `allure.label.<name>` becomes an Allure label.
    [
      'allure-playwright',
      {
        resultsDir: ALLURE_RESULTS_DIR,
        links: {
          issue: { urlTemplate: 'https://github.com/vasd85/playwright-typescript-e2e/issues/%s' },
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
    // Checks of the framework itself: no browser and no stand, so they run even when the stand is down.
    // Deterministic by construction, hence no retries even in CI.
    { name: 'unit', testDir: 'tests/unit', retries: 0 },
  ],
});
