import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test as base, type APIRequestContext, type PlaywrightTestOptions } from '@playwright/test';
import { SessionFileSchema, UserResponseSchema, type SessionFile } from '../api/schemas/user';
import { getCurrentUser, registerUser } from '../api/users.api';
import { env } from '../config/env';
import { uniqueId } from '../data/unique';
import { buildUser } from '../data/user.builder';

export type WorkerSession = SessionFile & {
  slot: number;
  workerIndex: number;
  outcome: 'registered' | 'reused' | 're-registered';
};

type WorkerFixtures = { workerAuth: WorkerSession };

type StorageState = NonNullable<PlaywrightTestOptions['storageState']>;

/** Storage state of a signed-out browser: a spec that drives the login forms opts in with `test.use`. */
export const NO_AUTH: StorageState = { cookies: [], origins: [] };

const ATTEMPTS = 3;

/**
 * One disposable user per worker, registered through the API at most once per worker process.
 * The session is kept in `<outputDir>/.auth/worker-<slot>.json`: the runner clears `outputDir`
 * at the start of a run, so the file lives exactly as long as the run, and a worker restarted
 * after a failure (same slot, new process) finds it, confirms with one `GET /user` that the
 * token still belongs to its user, and reuses it without registering again.
 */
export const test = base.extend<Record<never, never>, WorkerFixtures>({
  workerAuth: [
    async ({ playwright }, use, workerInfo) => {
      const slot = workerInfo.parallelIndex;
      const workerIndex = workerInfo.workerIndex;
      const statePath = path.join(workerInfo.project.outputDir, '.auth', `worker-${slot}.json`);
      // A clean context: no Authorization header ever reaches the registration request.
      const api = await playwright.request.newContext();
      try {
        const cached = readSession(statePath);
        if (cached && (await whoAmI(api, cached.token)) === cached.username) {
          console.log(`[auth] slot=${slot} worker=${workerIndex} reused=${cached.username}`);
          await use({ ...cached, slot, workerIndex, outcome: 'reused' });
          return;
        }
        const session = await registerVerified(api, slot, workerInfo.config.workers, workerIndex);
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

function stateFromToken(token: string): StorageState {
  return {
    cookies: [],
    origins: [
      { origin: new URL(env.BASE_URL).origin, localStorage: [{ name: 'jwtToken', value: token }] },
    ],
  };
}

function readSession(statePath: string): SessionFile | undefined {
  if (!existsSync(statePath)) return undefined;
  return SessionFileSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')));
}

function writeSession(statePath: string, { username, email, token }: SessionFile): void {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ username, email, token }));
}

/** The username the stand resolves the token to, or nothing when the token is dead. */
async function whoAmI(api: APIRequestContext, token: string): Promise<string | undefined> {
  const response = await getCurrentUser(api, token);
  if (response.status() !== 200) return undefined;
  return UserResponseSchema.parse(await response.json()).user.username;
}

/**
 * Waits for the next second whose epoch value is congruent to the slot modulo the number of
 * workers. The stand derives a token from the user id and the integer second, so registrations
 * that land in the same second share a token: every slot registers in a second of its own.
 */
async function staggerToSlotSecond(slot: number, workers: number): Promise<void> {
  const period = workers * 1000;
  const wait = (slot * 1000 - (Date.now() % period) + period) % period;
  await sleep(wait);
}

/**
 * Registers a fresh user and verifies with `GET /user` that the token really resolves to it.
 * A 201 is not proof: after a token collision the stand answers 201 and hands out a token
 * that belongs to somebody else. The outcome of a collision is not predictable, so the
 * identity check, not the stagger, is what catches it.
 */
async function registerVerified(
  api: APIRequestContext,
  slot: number,
  workers: number,
  workerIndex: number,
): Promise<SessionFile> {
  let lastUsername = '';
  let lastWho: string | undefined;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    await staggerToSlotSecond(slot, workers);
    const second = Math.floor(Date.now() / 1000) % workers;
    const user = buildUser(uniqueId(slot));
    const response = await registerUser(api, user);
    if (response.status() !== 201) {
      throw new Error(`POST /users responded ${response.status()}: ${await response.text()}`);
    }
    const { token } = UserResponseSchema.parse(await response.json()).user;
    const who = await whoAmI(api, token);
    if (who === user.username) {
      console.log(
        `[auth] slot=${slot} worker=${workerIndex} registered=${user.username} second=${second} attempts=${attempt}`,
      );
      return { username: user.username, email: user.email, token };
    }
    console.log(
      `[auth] slot=${slot} mismatch: token of ${user.username} resolves to ${who ?? 'nobody'}, retrying`,
    );
    lastUsername = user.username;
    lastWho = who;
  }
  throw new Error(
    `Worker slot ${slot}: the token of ${lastUsername} resolves to ${lastWho ?? 'nobody'} after ${ATTEMPTS} attempts (token collision on the stand)`,
  );
}
