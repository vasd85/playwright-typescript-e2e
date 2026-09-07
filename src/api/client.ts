import { env, type Env } from '../config/env';

/**
 * Builds an absolute API URL. Playwright's `baseURL` is not used for the API on purpose:
 * a path with a leading slash resolves against the origin and drops the `/api` prefix.
 */
export function apiUrl(path: string, { API_URL }: Pick<Env, 'API_URL'> = env): string {
  return `${API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
