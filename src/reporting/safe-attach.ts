import { test } from '@playwright/test';
import { collectSecrets, maskValues } from './redact-trace';

/**
 * Attaches a JSON snapshot to the current test with credentials masked. Every attachment
 * ends up in the report and in the CI artifact, so an API response pasted in as is would
 * publish the token it carries. The patterns and the masking are the ones the trace
 * redaction already uses, so an attachment and a trace hide the same things.
 *
 * The promise is returned, not swallowed: an attachment awaited inside a step is shown
 * inside that step, and one that loses the race with a failing assertion is lost.
 */
export function attachJson(name: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  const secrets = collectSecrets([text]);
  return test.info().attach(name, {
    body: maskValues(text, secrets).text,
    contentType: 'application/json',
  });
}
