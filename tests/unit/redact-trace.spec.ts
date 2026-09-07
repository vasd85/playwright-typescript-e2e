import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { collectSecrets, maskValues, redactTraceZip } from '../../src/reporting/redact-trace';

// Fragments in the shape a Playwright trace stores them: a request body, a response body,
// a request header from the network log and the storage state from the context options.
const PASSWORD = 'Secret-abc123';
const TOKEN = 'tok-0123456789abcdef';
const FRAGMENTS = [
  `{"user":{"username":"qa1","email":"qa1@example.com","password":"${PASSWORD}"}}`,
  `{"user":{"username":"qa1","token":"${TOKEN}","bio":null}}`,
  `{"name":"authorization","value":"Token ${TOKEN}"}`,
  `{"storageState":{"origins":[{"localStorage":[{"name":"jwtToken","value":"${TOKEN}"}]}]}}`,
];

test.describe('trace redaction', () => {
  test('masks every known form of a secret', () => {
    const secrets = collectSecrets(FRAGMENTS);
    expect([...secrets].sort()).toEqual([PASSWORD, TOKEN].sort());
    const masked = FRAGMENTS.map((fragment) => maskValues(fragment, secrets).text);
    for (const text of masked) {
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toContain(TOKEN);
    }
    expect(masked[0]).toContain('"password":"***"');
    expect(masked[1]).toContain('"token":"***"');
    expect(masked[2]).toContain('"value":"Token ***"');
    expect(masked[3]).toContain('"jwtToken","value":"***"');
  });

  test('masks a value found in one entry inside another entry', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redact-trace-'));
    const zipPath = path.join(dir, 'trace.zip');
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    writeFileSync(
      zipPath,
      zipSync({
        'resources/request-body': strToU8(FRAGMENTS[0]),
        'trace.trace': strToU8(
          `{"type":"before","params":{"value":"${PASSWORD}"}}\n<input __playwright_value_="${PASSWORD}">`,
        ),
        'resources/screenshot.jpeg': image,
      }),
    );
    const result = redactTraceZip(zipPath, new Set());
    const entries = unzipSync(readFileSync(zipPath));
    rmSync(dir, { recursive: true, force: true });

    expect(result.hits).toBe(3);
    expect(strFromU8(entries['trace.trace'])).not.toContain(PASSWORD);
    expect(strFromU8(entries['resources/request-body'])).toContain('"password":"***"');
    expect([...entries['resources/screenshot.jpeg']]).toEqual([...image]);
  });

  test('discovers a password typed into a form that was never submitted', () => {
    // The shapes are those of a real trace: the action record of the fill and the DOM snapshot.
    const fragments = [
      `{"type":"before","class":"Frame","method":"fill","params":{"selector":"internal:role=textbox[name=\\"Password\\"i]","strict":true,"value":"${PASSWORD}"}}`,
      `["INPUT",{"__playwright_value_":"${PASSWORD}","formcontrolname":"password","name":"password","placeholder":"Password","type":"password"}]`,
    ];
    expect([...collectSecrets([fragments[0]])]).toEqual([PASSWORD]);
    expect([...collectSecrets([fragments[1]])]).toEqual([PASSWORD]);
    const other = [
      `{"params":{"selector":"internal:role=textbox[name=\\"Email\\"i]","strict":true,"value":"${PASSWORD}"}}`,
      `["INPUT",{"__playwright_value_":"${PASSWORD}","name":"email","type":"email"}]`,
    ];
    expect(collectSecrets(other).size).toBe(0);
  });

  test('ignores short values', () => {
    const text = '{"user":{"password":"abc"}}';
    const secrets = collectSecrets([text]);
    expect(secrets.size).toBe(0);
    expect(maskValues(text, secrets).text).toContain('"password":"abc"');
  });
});
