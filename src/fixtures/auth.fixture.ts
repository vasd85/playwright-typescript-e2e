import { test as base } from '@playwright/test';
import type { SessionFile } from '../api/schemas/user';
import {
  readSession,
  registerVerified,
  sessionPath,
  stateFromToken,
  whoAmI,
  writeSession,
  type StorageState,
} from '../auth/worker-session';

type WorkerSession = SessionFile & {
  slot: number;
  workerIndex: number;
  outcome: 'registered' | 'reused' | 're-registered';
};

type WorkerFixtures = { workerAuth: WorkerSession };

/** Storage state of a signed-out browser: a spec that drives the login forms opts in with `test.use`. */
export const NO_AUTH: StorageState = { cookies: [], origins: [] };

/**
 * One disposable user per worker slot. The setup project registers the users before the
 * browser tests start, one per second, and keeps each session in
 * `<outputDir>/.auth/worker-<slot>.json`; the runner clears `outputDir` at the start of a run,
 * so a session lives exactly as long as the run. This fixture confirms with one `GET /user`
 * that the token still belongs to the slot's user and reuses it — also after a worker restart
 * (same slot, new process). It registers on its own only when the file is missing (a run
 * without the setup project) or the session is gone.
 */
export const test = base.extend<Record<never, never>, WorkerFixtures>({
  workerAuth: [
    async ({ playwright }, use, workerInfo) => {
      const slot = workerInfo.parallelIndex;
      const workerIndex = workerInfo.workerIndex;
      const statePath = sessionPath(workerInfo.project.outputDir, slot);
      // A clean context: no Authorization header ever reaches a registration request.
      const api = await playwright.request.newContext();
      try {
        const cached = readSession(statePath);
        if (cached && (await whoAmI(api, cached.token)) === cached.username) {
          console.log(`[auth] slot=${slot} worker=${workerIndex} reused=${cached.username}`);
          await use({ ...cached, slot, workerIndex, outcome: 'reused' });
          return;
        }
        // Other workers may be registering at the same moment: each slot takes a second of its own.
        const session = await registerVerified(
          api,
          slot,
          `slot=${slot} worker=${workerIndex}`,
          workerInfo.config.workers,
        );
        writeSession(statePath, session);
        await use({
          ...session,
          slot,
          workerIndex,
          outcome: cached ? 're-registered' : 'registered',
        });
      } finally {
        await api.dispose();
      }
    },
    { scope: 'worker' },
  ],

  // The browser context of every test starts signed in as the worker's user: the token goes
  // straight into localStorage, the way the application itself stores it. No login form.
  storageState: async ({ workerAuth }, use, testInfo) => {
    testInfo.annotations.push({
      type: 'auth',
      description: `slot ${workerAuth.slot}: ${workerAuth.outcome} ${workerAuth.username} (worker ${workerAuth.workerIndex})`,
    });
    await use(stateFromToken(workerAuth.token));
  },
});
