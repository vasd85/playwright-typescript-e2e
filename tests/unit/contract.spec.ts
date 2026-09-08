import { test, expect } from '@playwright/test';
import { ArticleSchema } from '../../src/api/schemas/article';
import { expectContract } from '../../src/reporting/contract';

const VALID = {
  slug: 'a-real-article',
  title: 'A real article',
  description: 'description',
  body: 'body',
  tagList: ['probe'],
  author: { username: 'qa1' },
};
const BROKEN = { ...VALID, body: null };

/** Names of the attachments recorded so far, in order. */
function attachmentNames(): string[] {
  return test.info().attachments.map((attachment) => attachment.name);
}

test.describe('article contract check', () => {
  test('passes on a response that matches the schema', async () => {
    await expectContract(ArticleSchema, VALID, {
      subject: 'Article',
      step: 'Check the contract of a real article',
      snapshot: 'article.json',
    });
    expect(attachmentNames()).toEqual(['article.json', 'violations.json']);
    const violations = test.info().attachments.at(-1)!.body!.toString('utf8');
    expect(JSON.parse(violations)).toEqual([]);
  });

  test('names the field and the value it got', async () => {
    // The canonical message: the CI gate of the failure demo matches on its beginning, and
    // the README quotes it, so it is pinned here rather than only in the task case.
    const error = await expectContract(ArticleSchema, BROKEN, {
      subject: 'Article',
      step: 'Check that the article body is not null',
      snapshot: 'article.broken.json',
    }).catch((thrown: unknown) => thrown);

    expect(String(error)).toContain(
      'Article contract violated: field "body" is required, received null',
    );
    expect(attachmentNames()).toEqual(['article.broken.json', 'violations.json']);
  });
});
