import { createArticle, deleteArticle, getArticle, listArticles } from '../../src/api/articles.api';
import { expectValid } from '../../src/api/expect-valid';
import {
  ArticleListResponseSchema,
  ArticleResponseSchema,
  type ListedArticle,
} from '../../src/api/schemas/article';
import { TagsResponseSchema } from '../../src/api/schemas/tags';
import { getTags } from '../../src/api/tags.api';
import { buildArticle } from '../../src/data/article.builder';
import { uniqueId } from '../../src/data/unique';
import { test, expect } from '../../src/fixtures';

/**
 * Kept out of the test body: a conditional there is what the lint rule forbids, and the throw is
 * the point - a session without a foreign article must say so, not skip the check.
 */
const articleOfAnotherAuthor = (articles: ListedArticle[], username: string): ListedArticle => {
  const other = articles.find((one) => one.author.username !== username);
  if (!other) {
    throw new Error(`No article of another author among the ${articles.length} the session lists`);
  }
  return other;
};

// Every request goes through the worker's own context (see getArticle): read anonymously, the
// check for "gone after the delete" would pass without the delete ever happening.
test.describe(
  'Conduit API articles',
  {
    tag: '@extra',
    annotation: [
      { type: 'allure.label.epic', description: 'Content' },
      { type: 'allure.label.feature', description: 'Conduit API articles' },
      {
        type: 'allure.label.story',
        description: 'Article lifecycle, authorship and tags over HTTP, without a browser',
      },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    test('creates, reads and deletes an article', async ({
      apiAsUser,
      workerAuth,
      createdArticles,
    }, testInfo) => {
      const article = buildArticle(uniqueId(testInfo.parallelIndex));

      const created = await test.step('Create the article over the API', async () => {
        const response = await createArticle(apiAsUser, article);
        expect(response.status(), 'POST /articles creates the article').toBe(201);
        const { article: stored } = await expectValid(
          ArticleResponseSchema,
          await response.json(),
          'article.json',
        );
        createdArticles.push(stored.slug); // Before the comparisons: a failing one must not strand it.

        expect(stored.title, 'the stand stored the title that was sent').toBe(article.title);
        expect(stored.description, 'the stand stored the description that was sent').toBe(
          article.description,
        );
        expect(stored.body, 'the stand stored the body that was sent').toBe(article.body);
        expect([...stored.tagList].sort(), 'the stand stored the tags that were sent').toEqual(
          [...article.tagList].sort(),
        );
        expect(stored.author.username, 'the article belongs to its author').toBe(
          workerAuth.username,
        );
        return stored;
      });

      await test.step('Read the article back', async () => {
        const response = await getArticle(apiAsUser, created.slug);
        expect(response.status(), 'GET /articles/:slug serves the article').toBe(200);
        const { article: read } = await expectValid(
          ArticleResponseSchema,
          await response.json(),
          'article.json',
        );
        expect(read.slug, 'the same article answers under its slug').toBe(created.slug);
        expect(read.body, 'the stored body survives the round trip').toBe(article.body);
      });

      await test.step('Delete the article', async () => {
        const response = await deleteArticle(apiAsUser, created.slug);
        expect(response.status(), 'DELETE /articles/:slug removes the article').toBe(204);
      });

      await test.step('Check that the article is gone', async () => {
        const response = await getArticle(apiAsUser, created.slug);
        expect(response.status(), 'the deleted article is no longer served').toBe(404);
      });
    });

    // The other author comes from the demo data: a second user of our own cannot be added to an
    // existing session without dropping the binding of the one already there.
    test('refuses to delete an article of another author', async ({ apiAsUser, workerAuth }) => {
      const foreign = await test.step('Find an article of another author', async () => {
        const response = await listArticles(apiAsUser);
        expect(response.status(), 'GET /articles answers with the list').toBe(200);
        const { articles } = await expectValid(
          ArticleListResponseSchema,
          await response.json(),
          'articles.json',
        );
        return articleOfAnotherAuthor(articles, workerAuth.username);
      });

      await test.step('Try to delete it as a user who does not own it', async () => {
        const response = await deleteArticle(apiAsUser, foreign.slug);
        expect(response.status(), 'DELETE refuses an article of another author').toBe(403);
      });

      await test.step('Check that the article is still there', async () => {
        const response = await getArticle(apiAsUser, foreign.slug);
        expect(response.status(), 'the refused delete left the article in place').toBe(200);
      });
    });

    test('lists the tag of an article it just created', async ({
      apiAsUser,
      createdArticles,
    }, testInfo) => {
      const id = uniqueId(testInfo.parallelIndex);
      const article = { ...buildArticle(id), tagList: [`qa${id}`] };

      await test.step('Create an article carrying a tag of its own', async () => {
        const response = await createArticle(apiAsUser, article);
        expect(response.status(), 'POST /articles creates the article').toBe(201);
        const { article: stored } = await expectValid(
          ArticleResponseSchema,
          await response.json(),
          'article.json',
        );
        createdArticles.push(stored.slug);
      });

      await test.step('Check that the tag list carries it', async () => {
        const response = await getTags(apiAsUser);
        expect(response.status(), 'GET /tags answers with the list').toBe(200);
        const { tags } = await expectValid(TagsResponseSchema, await response.json(), 'tags.json');
        expect(tags, 'the tag of the article just created is listed').toContain(article.tagList[0]);
      });
    });
  },
);
