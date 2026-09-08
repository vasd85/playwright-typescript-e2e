import { test, expect } from '@playwright/test';
import { getTags } from '../../src/api/tags.api';

// Runs before every other project. The public stand is the single point of failure of the
// suite, so an unreachable stand fails here, within seconds, with the address and the code.
test('Check that the Conduit API answers GET /tags', async ({ request }) => {
  const response = await getTags(request);
  expect(response.status(), `GET ${response.url()} responded ${response.status()}`).toBe(200);
});
