import type { ZodType } from 'zod';
import { attachJson, maskSecrets } from '../reporting/safe-attach';

/**
 * Parses a value against its schema and returns it typed. On a mismatch it attaches the value
 * and the violations to the report, then throws with what the violation costs followed by the
 * wording zod itself produced: the consequence is ours to state, the diagnosis is not.
 *
 * Outside a running test the value is still validated and the error still thrown; only the
 * attachments are skipped, because there is no report to put them in.
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
  throw new Error(
    maskSecrets(
      `Contract violated: the response does not carry what the application relies on - ${violations.join('; ')}`,
    ),
  );
}
