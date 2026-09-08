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

/** Enough of a rejected value to recognise it, not a whole payload. */
const SHOWN_VALUE_LIMIT = 120;

function violationsOf(schema: ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const at = issue.path.reduce<unknown>((node, key) => (node as never)?.[key], value);
    const shown = (JSON.stringify(at) ?? 'undefined').slice(0, SHOWN_VALUE_LIMIT);
    // An issue on the root of the schema has an empty path.
    const where = issue.path.length > 0 ? `field "${issue.path.join('.')}"` : 'the object';
    return `${where} is required, received ${shown}`;
  });
}

/**
 * Checks an object against its schema inside a named step, so a failure reads as a business
 * problem: red step, a message naming the field and the value, the snapshot next to it.
 *
 * `test.fail` goes immediately before the single assertion: a step that breaks earlier still
 * turns the test red, while anything after it counts as expected, fixture teardown included.
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
