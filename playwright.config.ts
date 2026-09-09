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
    // `chromium` is a scheduling dependency, not a data one: a later phase keeps these tests out of
    // the seconds in which the browser registration scenario issues its tokens, where sharing a
    // second hands both the same token. The cost, measured: a red browser test skips this project.
    // 60 s, not the global 30: registering a disposable account can spend up to 4 s waiting for the
    // second reserved for the slot and up to 8 s for the stand's clock to pass it, and it retries a
    // collision up to three times - about 37 s of ceiling, against 9 s observed at worst. The
    // registration happens inside a test, so its ceiling is the test's. Under --no-deps the worker
    // session registers too and the two ceilings add up; that case ends in a plain timeout, which
    // is the honest outcome for a stand colliding six times in a row.
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
