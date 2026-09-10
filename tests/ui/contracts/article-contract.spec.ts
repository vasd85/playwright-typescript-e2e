import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { apiUrl } from '../../../src/api/client';
import { expectValid } from '../../../src/api/expect-valid';
import { waitForApiResponse } from '../../../src/api/response';
import { ArticleEnvelopeSchema, ArticleSchema } from '../../../src/api/schemas/article';
import { env } from '../../../src/config/env';
import { test, expect, NO_AUTH } from '../../../src/fixtures';

// The case begins with a signed-out user: this file opts out of the worker session.
test.use({ storageState: NO_AUTH });

/**
 * A snapshot rather than a patch of a live response: were the stand to withhold the article,
 * a patched test would fail with "the body is null" while the real cause was an outage - the
 * one message this case exists to make trustworthy.
 */
const CORRUPTED = readFileSync(path.join(__dirname, 'article.broken.json'), 'utf8');
const corrupted = ArticleEnvelopeSchema.parse(JSON.parse(CORRUPTED)).article;
const ARTICLE_PATH = `articles/${corrupted.slug}`;
const ARTICLE_URL = apiUrl(ARTICLE_PATH);

/**
 * The comments of the same slug are served too, and the page does not render without them:
 * the stand answers 404 for an article it does not have, and the application then shows no
 * article at all. Measured by removing this route: the title never appears.
 */
const mockCorruptedArticle = async (page: Page): Promise<void> => {
  await page.route(ARTICLE_URL, (route) =>
    route.fulfill({ contentType: 'application/json', body: CORRUPTED }),
  );
  await page.route(`${ARTICLE_URL}/comments`, (route) => route.fulfill({ json: { comments: [] } }));
};

test.describe(
  'Article contract',
  {
    tag: '@tc-4',
    annotation: [
      { type: 'allure.label.epic', description: 'Content' },
      { type: 'allure.label.feature', description: 'Article contract' },
      { type: 'allure.label.story', description: 'A corrupted article object reaches the UI' },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    test('renders a corrupted article with nothing wrong on screen', async ({
      page,
      articlePage,
    }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      await test.step('Emulate a corrupted article JSON where body is null', async () => {
        // Both channels are subscribed before the navigation, or the first messages are missed.
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await mockCorruptedArticle(page);
      });

      await test.step('Open the article page', async () => {
        await articlePage.goto(corrupted.slug);
        await expect(articlePage.title).toHaveText(corrupted.title);
      });

      // Waiting for the renderer to have run and refused is what makes the checks below
      // meaningful: an empty body also describes a page that has simply not painted yet.
      await test.step('Check that the only trace is a console error', async () => {
        await expect
          .poll(() => consoleErrors.join('\n'), { message: 'the console reports the corruption' })
          // Verbatim wording of the markdown renderer on the stand: its upgrade reddens this
          // test with no defect of the application behind it.
          .toContain('marked(): input parameter is undefined or null');
      });

      await test.step('Check that nothing on the page reveals the corruption', async () => {
        await expect(articlePage.authorLink(corrupted.author.username)).toBeVisible();
        // Asserted before the negative check below: a text matcher that finds no element at all
        // satisfies its own negation, so the absence of a stray null means nothing until the
        // container is known to be on the page.
        await expect(articlePage.content).toBeVisible();
        await expect(articlePage.body).toBeEmpty();
        await expect(articlePage.content, 'the article body shows no stray null').not.toContainText(
          'null',
        );
        expect(pageErrors, 'the corruption did not crash the page').toEqual([]);
      });
    });

    test(
      'rejects an article whose body is null',
      {
        tag: '@failure-demo',
        annotation: [
          {
            type: 'issue',
            description:
              'https://github.com/vasd85/playwright-typescript-e2e/blob/main/README.md#failure-demo',
          },
          {
            type: 'description',
            description:
              'The corruption is emulated by a mock, so the check is expected to fail. In the ' +
              'normal run the failure is reported inside its step and the run stays green; with ' +
              'CONTRACT_FAILURE_DEMO=1 the same test really goes red, with a screenshot and a trace.',
          },
        ],
      },
      async ({ page, articlePage }) => {
        await test.step('Emulate a corrupted article JSON where body is null', async () => {
          await mockCorruptedArticle(page);
        });

        const response = await test.step('Open the article page', async () => {
          const served = await waitForApiResponse(page, 'GET', ARTICLE_PATH, () =>
            articlePage.goto(corrupted.slug),
          );
          await expect(articlePage.title).toHaveText(corrupted.title);
          return served;
        });

        // Taken from the response the page received, not from the file: reading the file back
        // would compare a constant with a schema and prove nothing about the mock.
        const { article } = ArticleEnvelopeSchema.parse(await response.json());

        await test.step('Check that the article body is not null', async () => {
          test.fail(
            !env.CONTRACT_FAILURE_DEMO,
            'The mock serves an article whose body is null on purpose.',
          );
          await expectValid(ArticleSchema, article, 'article.broken.json');
        });
      },
    );
  },
);
