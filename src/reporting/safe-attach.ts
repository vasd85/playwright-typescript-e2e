import { test } from '@playwright/test';
import { collectSecrets, maskValues } from './redact-trace';

/**
 * Masks the credentials a text carries. Used for attachments and for the message of an
 * assertion alike: a failure message reaches the terminal, the json report and the allure
 * result, and none of those is rewritten by the trace redaction of `global-teardown.ts`.
 */
export function maskSecrets(text: string): string {
  return maskValues(text, collectSecrets([text])).text;
}

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
  return test.info().attach(name, {
    body: maskSecrets(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}
