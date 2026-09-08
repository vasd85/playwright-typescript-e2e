import { test, expect } from '@playwright/test';
import { expectValid } from '../../src/api/expect-valid';
import { ArticleSchema } from '../../src/api/schemas/article';

const VALID = {
  slug: 'a-real-article',
  title: 'A real article',
  description: 'description',
  body: 'body',
  tagList: ['probe'],
  author: { username: 'qa1' },
};
const BROKEN = { ...VALID, body: null };

function attachmentNames(): string[] {
  return test.info().attachments.map((attachment) => attachment.name);
}

test.describe('Schema validation', () => {
  test('returns the value typed and attaches nothing when it matches', async () => {
    const article = await expectValid(ArticleSchema, VALID, 'article.json');

    expect(article.title).toBe(VALID.title);
    expect(attachmentNames()).toEqual([]);
  });

  test('attaches the value and throws with the wording zod produced', async () => {
    // The README quotes this message and the assignment asks for it by name, so the wording is
    // pinned here rather than only in the test case that demonstrates it.
    const error = await expectValid(ArticleSchema, BROKEN, 'article.broken.json').catch(
      (thrown: unknown) => thrown,
    );

    expect(String(error)).toContain(
      'Contract violated: field "body": Invalid input: expected string, received null',
    );
    expect(attachmentNames()).toEqual(['article.broken.json', 'violations.json']);
  });
});
