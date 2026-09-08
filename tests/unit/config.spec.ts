import { test, expect } from '@playwright/test';
import { apiUrl } from '../../src/api/client';
import { parseEnv } from '../../src/config/env';

const DEFAULTS = {
  BASE_URL: 'https://demo.realworld.show',
  API_URL: 'https://api.realworld.show/api',
  CONTRACT_FAILURE_DEMO: false,
};

test.describe('Environment schema', () => {
  test('defaults apply when variables are absent or empty', () => {
    expect(parseEnv({})).toEqual(DEFAULTS);
    expect(parseEnv({ BASE_URL: '', API_URL: '', CONTRACT_FAILURE_DEMO: '' })).toEqual(DEFAULTS);
  });

  test('an invalid URL is rejected with the variable name', () => {
    expect(() => parseEnv({ API_URL: 'not a url' })).toThrow(/API_URL/);
  });

  test('empty CONTRACT_FAILURE_DEMO keeps the normal mode', () => {
    expect(parseEnv({}).CONTRACT_FAILURE_DEMO).toBe(false);
    expect(parseEnv({ CONTRACT_FAILURE_DEMO: '' }).CONTRACT_FAILURE_DEMO).toBe(false);
    expect(parseEnv({ CONTRACT_FAILURE_DEMO: 'true' }).CONTRACT_FAILURE_DEMO).toBe(false);
  });

  test('CONTRACT_FAILURE_DEMO=1 enables the failure demo mode', () => {
    expect(parseEnv({ CONTRACT_FAILURE_DEMO: '1' }).CONTRACT_FAILURE_DEMO).toBe(true);
  });
});

test.describe('API URL builder', () => {
  test('keeps the /api prefix for a path with a leading slash', () => {
    const expected = 'https://api.realworld.show/api/users';
    expect(apiUrl('/users', parseEnv({ API_URL: 'https://api.realworld.show/api' }))).toBe(
      expected,
    );
    expect(apiUrl('/users', parseEnv({ API_URL: 'https://api.realworld.show/api/' }))).toBe(
      expected,
    );
  });
});
