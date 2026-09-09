import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { deleteArticle } from '../api/articles.api';
import { registerVerifiedAccount, type VerifiedAccount } from '../auth/worker-session';
import { LEAK_LOG_NAME } from '../config/global-setup';
import { test as authTest } from './auth.fixture';

type ApiWorkerFixtures = { apiAsUser: APIRequestContext };
type ApiTestFixtures = {
  createdArticles: string[];
  freshRegistration: VerifiedAccount;
  apiAsFreshUser: APIRequestContext;
};

/**
 * Extends the auth fixture rather than the bare test object: `apiAsUser` needs the token of
 * the worker's session, and a fixture can only depend on fixtures of its own chain.
 */
export const test = authTest.extend<ApiTestFixtures, ApiWorkerFixtures>({
  // Registration must not use this context: on this stand a registration carrying someone
  // else's token breaks that token, so it stays in auth.fixture.ts with a clean context.
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

  /**
   * A disposable account belonging to this test alone, registered the same verified way the
   * worker sessions are. Test-scoped rather than worker-scoped on purpose: a shared account would
   * make these tests order-dependent, because a login issues a new token and kills the previous
   * one, and a later test would then act from a dead session.
   */
  freshRegistration: async ({ playwright }, use, testInfo) => {
    // Clean, like every registration: see the note on registerUser.
    const api = await playwright.request.newContext();
    try {
      // The context outlives the registration on purpose: the response body stays readable only
      // while it does, and the test asserts the contract of that body itself.
      await use(
        await registerVerifiedAccount(
          api,
          testInfo.parallelIndex,
          `fresh slot=${testInfo.parallelIndex}`,
          testInfo.config.workers,
        ),
      );
    } finally {
      await api.dispose();
    }
  },

  /** The session of `freshRegistration`, as a context: one universe per token (see getArticle). */
  apiAsFreshUser: async ({ playwright, freshRegistration }, use) => {
    const api = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Token ${freshRegistration.token}` },
    });
    try {
      await use(api);
    } finally {
      await api.dispose();
    }
  },

  /** Slugs a test creates; the teardown removes them from the shared stand. */
  createdArticles: async ({ apiAsUser }, use, testInfo) => {
    const slugs: string[] = [];
    await use(slugs);

    const survived: string[] = [];
    for (const slug of slugs) {
      // One failed request must not stop the rest of the cleanup.
      try {
        const response = await deleteArticle(apiAsUser, slug);
        // 404: already gone, evicted by the stand or removed by the test itself.
        if (!response.ok() && response.status() !== 404)
          survived.push(`${slug} (${response.status()})`);
      } catch (error) {
        survived.push(`${slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    if (survived.length === 0) return;

    // The cleanup above always runs. What a test with an expected failure absorbs is the
    // error thrown from here, so the leak also goes where global teardown will find it.
    const message = `Articles left on the stand: ${survived.join(', ')}`;
    mkdirSync(testInfo.project.outputDir, { recursive: true });
    appendFileSync(path.join(testInfo.project.outputDir, LEAK_LOG_NAME), `${message}\n`);
    throw new Error(message);
  },
});
