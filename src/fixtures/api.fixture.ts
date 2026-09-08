import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { deleteArticle } from '../api/articles.api';
import { LEAK_LOG_NAME } from '../config/global-setup';
import { test as authTest } from './auth.fixture';

type ApiWorkerFixtures = { apiAsUser: APIRequestContext };
type ApiTestFixtures = { createdArticles: string[] };

/**
 * The API context of the worker's user and the cleanup of what the tests create.
 *
 * Extends the auth fixture rather than the bare test object: `apiAsUser` needs the token
 * of the worker's session, and a fixture can only depend on fixtures of its own chain.
 *
 * The stand is public and shared, so nothing a test creates may outlive it: a test pushes
 * the slug of every article it creates into `createdArticles`, and the teardown removes
 * them through the API.
 */
export const test = authTest.extend<ApiTestFixtures, ApiWorkerFixtures>({
  // Every request carries the token of the worker's user. Registration never uses this
  // context: on this stand a registration sent with someone else's token breaks that token,
  // so it stays in auth.fixture.ts with a clean context of its own.
  apiAsUser: [
    async ({ playwright, workerAuth }, use) => {
      const api = await playwright.request.newContext({
        extraHTTPHeaders: { Authorization: `Token ${workerAuth.token}` },
      });
      try {
        await use(api);
      } finally {
        await api.dispose();
      }
    },
    { scope: 'worker' },
  ],

  createdArticles: async ({ apiAsUser }, use, testInfo) => {
    const slugs: string[] = [];
    await use(slugs);

    const survived: string[] = [];
    for (const slug of slugs) {
      // One failed request must not stop the rest: the remaining slugs would stay on the
      // stand unreported. Every outcome is collected, and the loop always finishes.
      try {
        const response = await deleteArticle(apiAsUser, slug);
        // 404 means the article is already gone — evicted by the stand, or removed by the
        // test itself. Anything else leaves our data behind on a server we share.
        if (!response.ok() && response.status() !== 404)
          survived.push(`${slug} (${response.status()})`);
      } catch (error) {
        survived.push(`${slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    if (survived.length === 0) return;

    // A test that declared an expected failure absorbs everything after that declaration,
    // teardown included: measured, a throwing teardown after `test.fail` leaves the run
    // green. So the leak is also written where the run-wide teardown will find it.
    const message = `Articles left on the stand: ${survived.join(', ')}`;
    mkdirSync(testInfo.project.outputDir, { recursive: true });
    appendFileSync(path.join(testInfo.project.outputDir, LEAK_LOG_NAME), `${message}\n`);
    throw new Error(message);
  },
});
