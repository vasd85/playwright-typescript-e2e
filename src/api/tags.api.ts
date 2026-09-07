import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl } from './client';

export function getTags(request: APIRequestContext): Promise<APIResponse> {
  return request.get(apiUrl('tags'));
}
