import type { Page, Response } from '@playwright/test';
import { apiUrl } from '../../../src/api/client';
import {
  ArticleEnvelopeSchema,
  ArticleRequestSchema,
  ArticleSchema,
} from '../../../src/api/schemas/article';
import { ValidationErrorSchema } from '../../../src/api/schemas/errors';
import { buildArticle } from '../../../src/data/article.builder';
import { uniqueId } from '../../../src/data/unique';
import { expectContract } from '../../../src/reporting/contract';
import { test, expect } from '../../../src/fixtures';

/** Exact URL and method: a substring would also catch the feed, the comments and the favourites. */
const isArticleCreation = (response: Response): boolean =>
  response.url() === apiUrl('articles') && response.request().method() === 'POST';

const submitAndCatchResponse = (page: Page, submit: () => Promise<void>): Promise<Response> =>
  test.step('Intercept POST **/api/articles', async () => {
    const response = page.waitForResponse(isArticleCreation);
    await submit();
    return response;
  });

// The order of the messages follows the order of the fields in the response body; both were
// measured on this stand.
const ALL_FIELDS_BLANK = [
  "title can't be blank",
  "description can't be blank",
  "body can't be blank",
];

test.describe(
  'Article editor',
  {
    tag: '@tc-2',
    annotation: [
      { type: 'allure.label.epic', description: 'Content' },
      { type: 'allure.label.feature', description: 'Article editor' },
      { type: 'allure.label.story', description: 'Create an article with API validation' },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    test('rejects an empty form with a message for every required field', async ({
      editorPage,
      errorMessages,
      page,
    }) => {
      await test.step('Open the article editor', async () => {
        await editorPage.goto();
        await expect(editorPage.publishButton).toBeVisible();
      });

      const response = await submitAndCatchResponse(page, () => editorPage.submit());

      await test.step('Validate the response body from the server', async () => {
        expect(response.status(), 'POST /api/articles rejects an empty article').toBe(422);
        const { errors } = ValidationErrorSchema.parse(await response.json());
        expect(Object.keys(errors).sort(), 'every empty field is reported').toEqual([
          'body',
          'description',
          'title',
        ]);
      });

      await test.step('Check the errors shown in the form', async () => {
        await expect(errorMessages.messages).toHaveText(ALL_FIELDS_BLANK);
      });
    });

    test('reports only the fields left empty', async ({
      editorPage,
      errorMessages,
      page,
    }, testInfo) => {
      const article = buildArticle(uniqueId(testInfo.parallelIndex));

      await test.step('Open the article editor', async () => {
        await editorPage.goto();
        await expect(editorPage.publishButton).toBeVisible();
      });

      await test.step('Fill the form: Title only', async () => {
        await editorPage.titleInput.fill(article.title);
      });

      const response = await submitAndCatchResponse(page, () => editorPage.submit());

      await test.step('Validate the response body from the server', async () => {
        expect(response.status(), 'POST /api/articles rejects a partial article').toBe(422);
        const { errors } = ValidationErrorSchema.parse(await response.json());
        expect(Object.keys(errors).sort(), 'the filled field is not reported').toEqual([
          'body',
          'description',
        ]);
      });

      await test.step('Check that only the empty fields are reported in the form', async () => {
        await expect(errorMessages.messages).toHaveText([
          "description can't be blank",
          "body can't be blank",
        ]);
      });
    });

    test('publishes a filled article and opens it', async ({
      editorPage,
      articlePage,
      page,
      workerAuth,
      createdArticles,
    }, testInfo) => {
      const article = buildArticle(uniqueId(testInfo.parallelIndex));

      await test.step('Open the article editor', async () => {
        await editorPage.goto();
        await expect(editorPage.publishButton).toBeVisible();
      });

      await test.step('Fill the form: Title, Description, Body, Tags', async () => {
        await editorPage.fillForm(article);
      });

      const response = await submitAndCatchResponse(page, () => editorPage.submit());
      const { article: created } = ArticleEnvelopeSchema.parse(await response.json());
      // The cleanup is registered before the first assertion that could end the test.
      createdArticles.push(created.slug);

      await test.step('Validate the response body from the server', () => {
        expect(response.status(), 'POST /api/articles creates the article').toBe(201);
        const sent = ArticleRequestSchema.parse(response.request().postDataJSON()).article;
        expect(sent.title, 'the editor sent the title that was typed').toBe(article.title);
        expect(sent.description, 'the editor sent the description that was typed').toBe(
          article.description,
        );
        expect(sent.body, 'the editor sent the body that was typed').toBe(article.body);
        // The stand decides the order of the tags, so they are compared as a set.
        expect([...sent.tagList].sort(), 'the editor sent the tags that were typed').toEqual(
          [...article.tagList].sort(),
        );
      });

      await expectContract(ArticleSchema, created, {
        subject: 'Article',
        step: 'Check that the created article matches its contract',
        snapshot: 'article.json',
      });

      await test.step('Check the redirect to the created article page and the data shown', async () => {
        expect(created.slug, 'the stand assigned a slug').not.toBe('');
        await expect(page).toHaveURL(`/article/${created.slug}`);
        await expect(articlePage.title).toHaveText(article.title);
        await expect(articlePage.body).toContainText(article.body);
        await expect(articlePage.authorLink(workerAuth.username)).toBeVisible();
        await expect(articlePage.tags).toHaveCount(article.tagList.length);
        for (const tag of article.tagList) {
          await expect(articlePage.tags.filter({ hasText: tag })).toHaveCount(1);
        }
      });
    });

    test('recovers from a rejected submit and publishes', async ({
      editorPage,
      articlePage,
      errorMessages,
      page,
      createdArticles,
    }, testInfo) => {
      const article = buildArticle(uniqueId(testInfo.parallelIndex));

      await test.step('Open the article editor', async () => {
        await editorPage.goto();
        await expect(editorPage.publishButton).toBeVisible();
      });

      const rejected = await submitAndCatchResponse(page, () => editorPage.submit());

      await test.step('Check the errors shown in the form', async () => {
        expect(rejected.status(), 'POST /api/articles rejects an empty article').toBe(422);
        await expect(errorMessages.messages).toHaveText(ALL_FIELDS_BLANK);
      });

      await test.step('Fill the form: Title, Description, Body, Tags', async () => {
        await editorPage.fillForm(article);
      });

      const response = await submitAndCatchResponse(page, () => editorPage.submit());
      const { article: created } = ArticleEnvelopeSchema.parse(await response.json());
      createdArticles.push(created.slug);

      await test.step('Check the redirect to the created article page and the data shown', async () => {
        expect(response.status(), 'the retried submit creates the article').toBe(201);
        await expect(page).toHaveURL(`/article/${created.slug}`);
        await expect(articlePage.title).toHaveText(article.title);
      });
    });
  },
);
