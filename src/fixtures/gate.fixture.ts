import { test as base, type Route } from '@playwright/test';
import { apiUrl } from '../api/client';

type Gate = {
  /** Settles once the request is intercepted and held; rejects when no such request arrives in time. */
  held: Promise<void>;
  /** Lets the held request reach the stand. Safe to call more than once. */
  release: () => void;
};

type GateFixture = {
  /**
   * Holds every POST to that API path until `release` is called; after that, matching
   * requests pass through immediately. POST is the only method this suite gates.
   */
  hold: (method: 'POST', apiPath: string) => Promise<Gate>;
};

const GATE_TIMEOUT_MS = 5_000;

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (reason: Error) => void };

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A gate on a network request: the request is real and reaches the stand, only the moment
 * of its delivery is controlled. That makes an in-flight UI state (a disabled button while
 * the response is pending) deterministic instead of a race. Every gate is released in the
 * fixture teardown, so a failed assertion never leaves a request hanging, and the routes are
 * removed without waiting for handlers that may still be blocked.
 */
export const test = base.extend<{ gate: GateFixture }>({
  gate: async ({ page }, use) => {
    const gates: Gate[] = [];
    try {
      await use({
        hold: async (method, apiPath) => {
          const url = apiUrl(apiPath);
          const intercepted = deferred();
          const released = deferred();
          const timer = setTimeout(() => {
            intercepted.reject(
              new Error(
                `Gate: no ${method} ${url} request was intercepted within ${GATE_TIMEOUT_MS} ms`,
              ),
            );
          }, GATE_TIMEOUT_MS);
          // A gate that is never awaited must not surface as an unhandled rejection.
          intercepted.promise.catch(() => {});
          await page.route(url, async (route: Route) => {
            if (route.request().method() !== method) return route.continue();
            clearTimeout(timer);
            intercepted.resolve();
            await released.promise;
            await route.continue();
          });
          const gate: Gate = {
            held: intercepted.promise,
            release: () => {
              clearTimeout(timer);
              released.resolve();
            },
          };
          gates.push(gate);
          return gate;
        },
      });
    } finally {
      for (const gate of gates) gate.release();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  },
});
