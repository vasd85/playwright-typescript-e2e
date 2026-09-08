import { expect, test } from '@playwright/test';
import type { ZodType } from 'zod';
import { env } from '../config/env';
import { attachJson, maskSecrets } from './safe-attach';

export type ContractOptions = {
  /** Names the checked object in the failure message: `Article contract violated: …`. */
  subject: string;
  /** Business name of the step, in the words of the test case. */
  step: string;
  /** File name of the snapshot attachment, e.g. `article.broken.json`. */
  snapshot: string;
  /**
   * Reason to expect the check to fail, for a violation that is known and emulated on
   * purpose. Ignored in failure-demo mode, where the same test really goes red.
   */
  expectedFailure?: string;
};

/** How much of a rejected value the message shows: enough to recognise it, not a whole payload. */
const SHOWN_VALUE_LIMIT = 120;

/** `field "body" is required, received null` for every issue the schema reports. */
function violationsOf(schema: ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const at = issue.path.reduce<unknown>((node, key) => (node as never)?.[key], value);
    const shown = (JSON.stringify(at) ?? 'undefined').slice(0, SHOWN_VALUE_LIMIT);
    // An issue on the root of the schema has an empty path: name the object, not field "".
    const where = issue.path.length > 0 ? `field "${issue.path.join('.')}"` : 'the object';
    return `${where} is required, received ${shown}`;
  });
}

/**
 * Checks an object against its schema inside a named step, so that a failure reads as a
 * business problem: the step goes red, the message names the field and the value it got,
 * and the snapshot of the object sits inside that same step.
 *
 * The order is deliberate. Both attachments are awaited before the check, because an
 * attachment racing a thrown assertion is lost, and the report of the failure is the whole
 * point. `test.fail` stands immediately before the single assertion, so a step that breaks
 * earlier still turns the test red. What follows the call is covered by the expectation —
 * fixture teardown included, measured: a throwing teardown after `test.fail` leaves the run
 * green — so the article cleanup reports a leak through global teardown as well.
 *
 * The message is masked like the attachments: it reaches the terminal, the json report and
 * the allure result, none of which the trace redaction rewrites.
 */
export async function expectContract(
  schema: ZodType,
  value: unknown,
  options: ContractOptions,
): Promise<void> {
  await test.step(options.step, async () => {
    const violations = violationsOf(schema, value);
    await attachJson(options.snapshot, value);
    await attachJson('violations.json', violations);
    if (options.expectedFailure && !env.CONTRACT_FAILURE_DEMO) {
      test.fail(true, options.expectedFailure);
    }
    const message = `${options.subject} contract violated: ${violations.join('; ')}`;
    expect(violations, maskSecrets(message)).toEqual([]);
  });
}
