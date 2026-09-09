import { errors, type Page, type Response } from '@playwright/test';
import { apiUrl } from './client';

// Measured 2026-09-10: the slowest of the waits in the suite took 1.4 s. Ten seconds is
// generous for the shared stand and still leaves two thirds of the 30 s test budget, so the
// message below is what a test reports instead of running out of time in silence.
const RESPONSE_TIMEOUT_MS = 10_000;

/**
 * Waits for the response to one API call the page makes while `act` runs. The action comes in
 * as a callback so that the wait is always registered before it, and a missed match names the
 * request: with a function predicate Playwright can only say that some response never came,
 * which reads as an outage of the stand rather than a test that stopped matching.
 *
 * The URL is compared in full rather than by substring: `/articles` also begins the paths of
 * the feed, the comments and the favourites.
 */
export async function waitForApiResponse(
  page: Page,
  method: string,
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
