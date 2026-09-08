import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl } from './client';

/**
 * Removes an article. The context must carry the token of its author: the stand keeps
 * articles inside the session of the token that created them.
 */
export function deleteArticle(request: APIRequestContext, slug: string): Promise<APIResponse> {
  return request.delete(apiUrl(`articles/${slug}`));
}
