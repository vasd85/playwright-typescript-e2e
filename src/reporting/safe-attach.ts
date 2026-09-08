import { test, type TestInfo } from '@playwright/test';
import { collectSecrets, maskValues } from './redact-trace';

/**
 * Masks credentials in a text on its way to a report — an attachment or an assertion message.
 * Neither is rewritten by the trace redaction of `global-teardown.ts`.
 */
export function maskSecrets(text: string): string {
  return maskValues(text, collectSecrets([text])).text;
}

/** `test.info()` throws outside a running test, and Playwright exposes no accessor that does not. */
function runningTest(): TestInfo | undefined {
  try {
    return test.info();
  } catch {
    return undefined;
  }
}

/**
 * Attaches a JSON snapshot to the current test with credentials masked. Awaiting it is what
 * puts the attachment inside the running step and ahead of the assertion that may end the test.
 *
 * Outside a test there is no report to attach to, and the snapshot is skipped rather than
 * thrown over: measured, an unguarded call from global setup aborts the run before a single
 * test starts.
 */
export async function attachJson(name: string, value: unknown): Promise<void> {
  await runningTest()?.attach(name, {
    body: maskSecrets(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}
