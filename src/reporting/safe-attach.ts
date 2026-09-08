import { test } from '@playwright/test';
import { collectSecrets, maskValues } from './redact-trace';

/**
 * Masks credentials in a text on its way to a report — an attachment or an assertion message.
 * Neither is rewritten by the trace redaction of `global-teardown.ts`.
 */
export function maskSecrets(text: string): string {
  return maskValues(text, collectSecrets([text])).text;
}

/**
 * Attaches a JSON snapshot to the current test with credentials masked. Awaiting it is what
 * puts the attachment inside the running step and ahead of the assertion that may end the test.
 */
export function attachJson(name: string, value: unknown): Promise<void> {
  return test.info().attach(name, {
    body: maskSecrets(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}
