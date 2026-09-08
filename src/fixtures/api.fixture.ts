import type { APIRequestContext } from '@playwright/test';
import { deleteArticle } from '../api/articles.api';
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

  createdArticles: async ({ apiAsUser }, use) => {
    const slugs: string[] = [];
    await use(slugs);
    const survived: string[] = [];
    for (const slug of slugs) {
      const response = await deleteArticle(apiAsUser, slug);
      // 404 means the article is already gone — evicted by the stand, or removed by the
      // test itself. Anything else leaves our data behind on a server we share.
      if (!response.ok() && response.status() !== 404) {
        survived.push(`${slug} (${response.status()})`);
      }
    }
    if (survived.length > 0) {
      throw new Error(`Articles left on the stand: ${survived.join(', ')}`);
    }
  },
});
