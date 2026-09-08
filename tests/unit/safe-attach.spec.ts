import { test, expect } from '@playwright/test';
import { attachJson, maskSecrets } from '../../src/reporting/safe-attach';

const TOKEN = 'tok-0123456789abcdef';
const RESPONSE = { user: { username: 'qa1', email: 'qa1@example.com', token: TOKEN } };

function attachmentBody(name: string): string {
  const attachment = test.info().attachments.find((recorded) => recorded.name === name);
  if (!attachment?.body) throw new Error(`No attachment named ${name} carries a body`);
  return attachment.body.toString('utf8');
}

test.describe('Safe attachments', () => {
  test('masks a token before it reaches the report', async () => {
    await attachJson('user.json', RESPONSE);
    const body = attachmentBody('user.json');
    expect(body).toContain('"token": "***"');
    expect(body).not.toContain(TOKEN);
    expect(body).toContain('"username": "qa1"');
  });

  test('leaves a value too short to be a credential alone', async () => {
    await attachJson('short.json', { user: { token: 'abc' } });
    // Documented limit of collectSecrets: under eight characters is not a secret.
    expect(attachmentBody('short.json')).toContain('"token": "abc"');
  });

  test('masks a token in an assertion message', () => {
    const message = `Article contract violated: field "user" is required, received {"token":"${TOKEN}"}`;
    expect(maskSecrets(message)).toContain('"token":"***"');
    expect(maskSecrets(message)).not.toContain(TOKEN);
  });
});
