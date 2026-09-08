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

function attachmentNames(): string[] {
  return test.info().attachments.map((attachment) => attachment.name);
}

function attachmentBody(name: string): string {
  const attachment = test.info().attachments.find((recorded) => recorded.name === name);
  if (!attachment?.body) throw new Error(`No attachment named ${name} carries a body`);
  return attachment.body.toString('utf8');
}

test.describe('Article contract check', () => {
  test('passes on a response that matches the schema', async () => {
    await expectContract(ArticleSchema, VALID, {
      subject: 'Article',
      step: 'Check the contract of a real article',
      snapshot: 'article.json',
    });
    expect(attachmentNames()).toEqual(['article.json', 'violations.json']);
    expect(JSON.parse(attachmentBody('violations.json'))).toEqual([]);
  });

  test('fails with a message that names the field and the value it got', async () => {
    // The CI gate of the failure demo matches on the beginning of this message and the README
    // quotes it, so the wording is pinned here rather than only in the task case.
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
