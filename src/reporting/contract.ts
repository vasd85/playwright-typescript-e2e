import { expect, test } from '@playwright/test';
import type { ZodType } from 'zod';
import { env } from '../config/env';
import { attachJson } from './safe-attach';

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

/** `field "body" is required, received null` for every issue the schema reports. */
function violationsOf(schema: ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const at = issue.path.reduce<unknown>((node, key) => (node as never)?.[key], value);
    return `field "${issue.path.join('.')}" is required, received ${JSON.stringify(at) ?? 'undefined'}`;
  });
}

/**
 * Checks an object against its schema inside a named step, so that a failure reads as a
 * business problem: the step goes red, the message names the field and the value it got,
 * and the snapshot of the object sits inside that same step.
 *
 * The order is deliberate. Both attachments are awaited before the check, because an
 * attachment racing a thrown assertion is lost, and the report of the failure is the whole
 * point. `test.fail` stands immediately before the single assertion: it narrows the
 * expectation to what follows it, so anything else that breaks in this test still goes red.
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
    expect(violations, `${options.subject} contract violated: ${violations.join('; ')}`).toEqual(
      [],
    );
  });
}
