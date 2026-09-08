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
    issue: 'README#failure-demo',
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

function problemsOf(tests) {
  const problems = [];
  if (tests.length === 0) problems.push('no tests in the report');
  for (const test of tests) {
    const entry = registry.find((candidate) => test.tags.includes(bare(candidate.tag)));
    if (!entry) {
      if (test.status === 'unexpected') problems.push(`unexpected failure: "${test.title}"`);
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

const problems =
  reportPath && fs.existsSync(reportPath)
    ? problemsOf(collect(JSON.parse(fs.readFileSync(reportPath, 'utf8'))))
    : [`report not found: ${reportPath}`];

console.log(
  problems.length
    ? `expected-red gate: FAIL\n  - ${problems.join('\n  - ')}`
    : `expected-red gate: OK (registry: ${registry.length} expected red)`,
);
process.exit(problems.length ? 1 : 0);
