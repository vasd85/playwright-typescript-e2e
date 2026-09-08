import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl } from './client';

/** Removes an article. The context must carry the token of its author. */
export function deleteArticle(request: APIRequestContext, slug: string): Promise<APIResponse> {
  return request.delete(apiUrl(`articles/${slug}`));
}
