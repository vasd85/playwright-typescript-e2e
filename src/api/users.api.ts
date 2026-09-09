import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl } from './client';
import type { NewUser } from './schemas/user';

/**
 * Registers a disposable account. The context must carry no Authorization header:
 * a foreign token in this request breaks that token on the stand.
 */
export function registerUser(request: APIRequestContext, user: NewUser): Promise<APIResponse> {
  return request.post(apiUrl('users'), { data: { user } });
}

/** Asks the stand which user the token belongs to. */
export function getCurrentUser(request: APIRequestContext, token: string): Promise<APIResponse> {
  return request.get(apiUrl('user'), { headers: { Authorization: `Token ${token}` } });
}

/**
 * Signs in an existing account. The context must be a clean one: the stand issues a new token on
 * every login and drops the previous one, so a login as the worker user would kill its session.
 */
export function loginUser(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<APIResponse> {
  return request.post(apiUrl('users/login'), { data: { user: credentials } });
}
