import type { NewArticle } from '../api/schemas/article';

/** A disposable article; the title is unique per run so parallel tests never collide. */
export function buildArticle(id: string): NewArticle {
  return {
    title: `QA article ${id}`,
    description: `Created by the E2E suite, run ${id}`,
    body: `Body of the article created by the E2E suite, run ${id}.`,
    tagList: ['qa-automation', 'playwright'],
  };
}
