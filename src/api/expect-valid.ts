import type { ZodType } from 'zod';
import { attachJson, maskSecrets } from '../reporting/safe-attach';

/**
 * Parses a value against its schema and returns it typed. On a mismatch it attaches the value
 * and the violations to the report, then throws with the wording zod itself produced.
 *
 * Test code only: the attachments go through `test.info()`, which throws outside a running test.
 * Never call this from a worker-scoped fixture or from global setup.
 */
export async function expectValid<T>(
  schema: ZodType<T>,
  value: unknown,
  snapshot: string,
): Promise<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  const violations = parsed.error.issues.map((issue) => {
    // An issue on the root of the schema has an empty path.
    const at = issue.path.length > 0 ? `field "${issue.path.join('.')}"` : 'the object';
    return `${at}: ${issue.message}`;
  });
  // Awaited before the throw: an attachment that loses the race with the exception is lost.
  await attachJson(snapshot, value);
  await attachJson('violations.json', violations);
  throw new Error(maskSecrets(`Contract violated: ${violations.join('; ')}`));
}
