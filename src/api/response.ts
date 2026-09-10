import { errors, type Page, type Response } from '@playwright/test';
import { apiUrl } from './client';

// Generous for the shared stand, and short enough that a test with two waits still has budget
// left to report the message below instead of running out of time in silence.
const RESPONSE_TIMEOUT_MS = 10_000;

/**
 * Waits for the response to one API call the page makes while `act` runs. The action is a
 * callback so the wait cannot be registered after it, and a missed match names the request:
 * Playwright alone can only say that some response never came, which reads as an outage.
 * The URL is compared in full - `/articles` also begins the feed, the comments and the
 * favourites.
 */
export async function waitForApiResponse(
  page: Page,
  method: 'GET' | 'POST',
  path: string,
  act: () => Promise<void>,
): Promise<Response> {
  const url = apiUrl(path);
  const response = page.waitForResponse(
    (candidate) => candidate.url() === url && candidate.request().method() === method,
    { timeout: RESPONSE_TIMEOUT_MS },
  );
  // Whenever `act` throws first, nobody awaits this promise and its rejection is unhandled.
  void response.catch(() => undefined);
  await act();
  try {
    return await response;
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      throw new Error(`No response to ${method} ${url} in ${RESPONSE_TIMEOUT_MS} ms`, {
        cause: error,
      });
    }
    throw error;
  }
}
