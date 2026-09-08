import { defineConfig } from 'allure';

// The reporter in playwright.config.ts only writes results; the report is built from them by
// `npm run report:allure`, and the categories below are computed at that point.
export default defineConfig({
  name: 'Conduit E2E',
  output: './allure-report',
  plugins: {
    awesome: { options: { reportName: 'Conduit E2E' } },
  },
  // A failed test is matched against these rules top to bottom; the first hit becomes its
  // category. The names are our own, not the built-in "Product errors": a failure lands in
  // the built-in category with no rules at all, so only our own name proves a rule matched.
  categories: {
    rules: [
      {
        name: 'Article contract defect',
        matchers: { statuses: ['failed'], message: /contract violated/ },
      },
      // An outage of the shared demo stand is not a defect of the application under test.
      {
        name: 'Stand or network problem',
        matchers: {
          statuses: ['failed', 'broken'],
          message: /Timeout .* exceeded|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_/,
        },
      },
    ],
  },
});
