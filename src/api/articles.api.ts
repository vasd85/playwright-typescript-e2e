import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl } from './client';
import type { NewArticle } from './schemas/article';

/** Removes an article. The context must carry the token of its author. */
export function deleteArticle(request: APIRequestContext, slug: string): Promise<APIResponse> {
  return request.delete(apiUrl(`articles/${slug}`));
}

/** Creates an article. The context must carry the token of its author-to-be. */
export function createArticle(
  request: APIRequestContext,
  article: NewArticle,
): Promise<APIResponse> {
  return request.post(apiUrl('articles'), { data: { article } });
}

/**
 * Reads one article. Articles are public in the RealWorld specification, but not on this stand:
 * a request without a token opens a fresh session of its own, so the article a worker created is
 * simply not there. Measured: the author reads it with 200, an anonymous request gets 404.
 * Which context asks therefore decides which universe answers.
 */
export function getArticle(request: APIRequestContext, slug: string): Promise<APIResponse> {
  return request.get(apiUrl(`articles/${slug}`));
}

/** Lists the articles of the session the context belongs to. */
export function listArticles(request: APIRequestContext): Promise<APIResponse> {
  return request.get(apiUrl('articles'));
}
