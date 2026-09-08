import { defineConfig } from 'allure';

/**
 * Report-side configuration: the reporter in playwright.config.ts only writes results,
 * the categories below are computed by `npm run report:allure` when the report is built.
 *
 * Category names are deliberately not the built-in "Product errors" and "Test errors":
 * a failed test lands in the built-in one even when no rule matches, so a distinct name
 * is what proves that a rule of ours fired.
 */
export default defineConfig({
  name: 'Conduit E2E',
  output: './allure-report',
  plugins: {
    awesome: { options: { reportName: 'Conduit E2E' } },
  },
  categories: {
    rules: [
      {
        // The article contract check of TC4 and every future schema check: the message of
        // expectContract always starts with `<subject> contract violated`.
        name: 'Article contract defect',
        matchers: { statuses: ['failed'], message: /contract violated/ },
      },
      {
        // The public demo stand is shared and outside our control: its outages must not
        // read as defects of the application under test.
        name: 'Stand or network problem',
        matchers: {
          statuses: ['failed', 'broken'],
          message: /Timeout .* exceeded|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_/,
        },
      },
    ],
  },
});
