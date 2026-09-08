// External gate for the failure demo: reads the JSON reporter output of a finished run and
// exits non-zero unless the set of failed tests equals the registry below, each failing with
// its business text. Used by the CI job `failure-demo`, where the run itself is allowed to be
// red and only this verdict decides the job.
// usage: node scripts/check-expected-red.mjs <report.json> [registry.json]
import fs from 'node:fs';

/** Tests that are expected to be red, by tag, with a substring of the error each must carry. */
const DEFAULT_REGISTRY = [
  {
    tag: '@failure-demo',
    message: 'Article contract violated',
    issue: 'https://github.com/vasd85/playwright-typescript-e2e/blob/main/README.md#failure-demo',
  },
];

const [reportPath, registryPath] = process.argv.slice(2);
const registry = registryPath
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : DEFAULT_REGISTRY;

// The JSON reporter stores tags without the leading @.
const bare = (tag) => tag.replace(/^@/, '');

function collect(report) {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        tests.push({
          title: spec.title,
          tags: spec.tags ?? [],
          status: test.status,
          errors: test.results.flatMap((result) =>
            result.errors.map((error) => error.message ?? ''),
          ),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return tests;
}

function problemsOf(report, tests) {
  const problems = [];
  if (tests.length === 0) problems.push('no tests in the report');
  // Failures outside any test - a broken global setup, for one - are reported here and nowhere
  // in the suites, so a run that never reached the expected red test would otherwise pass.
  for (const error of report.errors ?? []) {
    problems.push(`error outside the tests: ${(error.message ?? '').split('\n')[0]}`);
  }
  for (const test of tests) {
    const entry = registry.find((candidate) => test.tags.includes(bare(candidate.tag)));
    if (!entry) {
      // `flaky` counts too: a retried failure is still a failure nobody registered, and the
      // demo command pins --retries 0 only for as long as nobody edits it.
      if (test.status === 'unexpected' || test.status === 'flaky') {
        problems.push(`unexpected failure: "${test.title}" (${test.status})`);
      }
      continue;
    }
    if (test.status !== 'unexpected') {
      problems.push(
        `expected red test did not fail: "${test.title}" (${test.status}), see ${entry.issue}`,
      );
    } else if (!test.errors.some((message) => message.includes(entry.message))) {
      const first = (test.errors[0] ?? '').split('\n')[0];
      problems.push(`expected red test failed for another reason: "${test.title}": ${first}`);
    }
  }
  for (const entry of registry) {
    if (!tests.some((test) => test.tags.includes(bare(entry.tag)))) {
      problems.push(`expected red test is missing from the run (tag ${entry.tag}, ${entry.issue})`);
    }
  }
  return problems;
}

function verdict() {
  if (!reportPath || !fs.existsSync(reportPath)) return [`report not found: ${reportPath}`];
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return problemsOf(report, collect(report));
}

const problems = verdict();

console.log(
  problems.length
    ? `expected-red gate: FAIL\n  - ${problems.join('\n  - ')}`
    : `expected-red gate: OK (registry: ${registry.length} expected red)`,
);
process.exit(problems.length ? 1 : 0);
