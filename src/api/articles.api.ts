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
 * Reads one article. Which context asks decides which universe answers: the stand keeps a
 * separate session per token, so an anonymous read never finds an article a worker created.
 */
export function getArticle(request: APIRequestContext, slug: string): Promise<APIResponse> {
  return request.get(apiUrl(`articles/${slug}`));
}

/** Lists the articles of the session the context belongs to. */
export function listArticles(request: APIRequestContext): Promise<APIResponse> {
  return request.get(apiUrl('articles'));
}
