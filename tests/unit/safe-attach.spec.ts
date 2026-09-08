import { test, expect } from '@playwright/test';
import { attachJson } from '../../src/reporting/safe-attach';

// A response of the stand in the shape the API layer returns it: the token is the field
// that must never reach a report artifact.
const TOKEN = 'tok-0123456789abcdef';
const RESPONSE = { user: { username: 'qa1', email: 'qa1@example.com', token: TOKEN } };

/** The body of the attachment recorded last: an inline attachment keeps it in memory. */
function lastAttachmentBody(): string {
  const attachment = test.info().attachments.at(-1);
  expect(attachment?.body, 'the attachment carries a body').toBeTruthy();
  return attachment!.body!.toString('utf8');
}

test.describe('safe attachments', () => {
  test('masks a token before it reaches the report', async () => {
    await attachJson('user.json', RESPONSE);
    const body = lastAttachmentBody();
    expect(body).toContain('"token": "***"');
    expect(body).not.toContain(TOKEN);
    // The rest of the object survives: an attachment is evidence, not a black box.
    expect(body).toContain('"username": "qa1"');
  });

  test('leaves a value too short to be a credential alone', async () => {
    await attachJson('short.json', { user: { token: 'abc' } });
    // Documented limit of collectSecrets: values under eight characters are not secrets,
    // otherwise every short word in a body would be masked.
    expect(lastAttachmentBody()).toContain('"token": "abc"');
  });
});
