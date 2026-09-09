import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { APIRequestContext, APIResponse, PlaywrightTestOptions } from '@playwright/test';
import {
  AuthUserResponseSchema,
  SessionFileSchema,
  type NewUser,
  type SessionFile,
} from '../api/schemas/user';
import { getCurrentUser, registerUser } from '../api/users.api';
import { env } from '../config/env';
import { uniqueId } from '../data/unique';
import { buildUser } from '../data/user.builder';

export type StorageState = NonNullable<PlaywrightTestOptions['storageState']>;

export const ATTEMPTS = 3;

/**
 * A registered account with everything the caller may need: the credentials it was built from,
 * the verified token, and the registration response itself, so a test can assert the contract of
 * the body this helper already read for the token.
 */
export type VerifiedAccount = { user: NewUser; token: string; response: APIResponse };
// The identity is checked in a request the stand dates at least this many seconds after the
// registration: one second for the token's second to end, one more because the stand's
// `Date` header may lag behind its clock by up to a second.
const SECONDS_AFTER_REGISTRATION = 2;
const IDENTITY_CHECK_DEADLINE_MS = 8_000;

/** Where the session of a worker slot lives: inside the output directory the runner clears at the start of a run. */
export function sessionPath(outputDir: string, slot: number): string {
  return path.join(outputDir, '.auth', `worker-${slot}.json`);
}

export function readSession(statePath: string): SessionFile | undefined {
  if (!existsSync(statePath)) return undefined;
  return SessionFileSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')));
}

export function writeSession(statePath: string, { username, email, token }: SessionFile): void {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ username, email, token }));
}

/** A browser storage state signed in with the token, the way the application itself stores it. */
export function stateFromToken(token: string): StorageState {
  return {
    cookies: [],
    origins: [
      { origin: new URL(env.BASE_URL).origin, localStorage: [{ name: 'jwtToken', value: token }] },
    ],
  };
}

/** The username the stand resolves the token to, or nothing when the token is dead. */
export async function whoAmI(api: APIRequestContext, token: string): Promise<string | undefined> {
  const response = await getCurrentUser(api, token);
  if (response.status() !== 200) return undefined;
  return AuthUserResponseSchema.parse(await response.json()).user.username;
}

/** The second of the stand's clock at which it sent the response, from the `Date` header. */
export function serverSecond(response: APIResponse): number {
  const date = Date.parse(response.headers()['date'] ?? '');
  if (Number.isNaN(date)) throw new Error('The stand answered without a Date header');
  return Math.floor(date / 1000);
}

/**
 * The username the token resolves to, asked in a request the stand dates after the
 * registration second is over. The stand's clock, not ours, decides which second a token
 * belongs to, so waiting by our own clock is not enough when the two disagree.
 */
async function whoAmIAfter(
  api: APIRequestContext,
  token: string,
  registeredSecond: number,
): Promise<{ who: string | undefined; second: number }> {
  const deadline = Date.now() + IDENTITY_CHECK_DEADLINE_MS;
  await sleep(1_500);
  for (;;) {
    const response = await getCurrentUser(api, token);
    const second = serverSecond(response);
    if (second >= registeredSecond + SECONDS_AFTER_REGISTRATION) {
      if (response.status() !== 200) return { who: undefined, second };
      return { who: AuthUserResponseSchema.parse(await response.json()).user.username, second };
    }
    if (Date.now() > deadline) {
      throw new Error(
        `The stand clock did not move past the registration second ${registeredSecond}`,
      );
    }
    await sleep(300);
  }
}

/**
 * Waits for the next second whose epoch value is congruent to the slot modulo the number of
 * workers, so that workers registering at the same time land in seconds of their own.
 */
export async function staggerToSlotSecond(slot: number, workers: number): Promise<void> {
  const period = workers * 1000;
  const wait = (slot * 1000 - (Date.now() % period) + period) % period;
  await sleep(wait);
}

/**
 * Registers a fresh user and verifies with `GET /user` that the token really resolves to it.
 * A 201 is not proof: the stand derives the token from the user id and the integer second,
 * and every anonymous registration on this shared stand gets the same user id, so any other
 * registration in the same second yields the same token and rebinds it to its own session,
 * whoever registered last. The identity is therefore checked in a request the stand itself
 * dates after that second has passed, when the binding can no longer change. A mismatch
 * means a collision: a new user is registered in a new second. With `staggerWorkers` set, every
 * attempt first waits for the second reserved for the slot; callers that register sequentially
 * need no stagger.
 *
 * The response is returned alive: its body stays readable only while the request context lives,
 * so the caller must not dispose the context before whoever reads it is done.
 *
 * `label` is composed by the caller and not here, because the three callers print three different
 * shapes, and two of them are what README points at as the proof of one authorization per worker:
 * `setup slot=<n>` and `slot=<n> worker=<m>`. A single rule here could not reproduce both.
 */
export async function registerVerifiedAccount(
  api: APIRequestContext,
  slot: number,
  label: string,
  staggerWorkers?: number,
): Promise<VerifiedAccount> {
  let lastUsername = '';
  let lastWho: string | undefined;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (staggerWorkers !== undefined) await staggerToSlotSecond(slot, staggerWorkers);
    const user = buildUser(uniqueId(slot));
    const response = await registerUser(api, user);
    if (response.status() !== 201) {
      throw new Error(`POST /users responded ${response.status()}: ${await response.text()}`);
    }
    const registeredSecond = serverSecond(response);
    const { token } = AuthUserResponseSchema.parse(await response.json()).user;
    const { who, second } = await whoAmIAfter(api, token, registeredSecond);
    if (who === user.username) {
      console.log(
        `[auth] ${label} registered=${user.username} attempts=${attempt} second=${registeredSecond} verified-at=${second}`,
      );
      return { user, token, response };
    }
    console.log(
      `[auth] ${label} mismatch: token of ${user.username} resolves to ${who ?? 'nobody'}, retrying`,
    );
    lastUsername = user.username;
    lastWho = who;
  }
  throw new Error(
    `Worker slot ${slot}: the token of ${lastUsername} resolves to ${lastWho ?? 'nobody'} after ${ATTEMPTS} attempts (token collision on the stand)`,
  );
}

/**
 * The same registration without the password: what a worker session is made of. The password of
 * `registerVerifiedAccount` stays in the memory of whoever asked for it and never reaches the
 * slot file, which `writeSession` keeps down to three fields.
 */
export async function registerVerified(
  api: APIRequestContext,
  slot: number,
  label: string,
  staggerWorkers?: number,
): Promise<SessionFile> {
  const { user, token } = await registerVerifiedAccount(api, slot, label, staggerWorkers);
  return { username: user.username, email: user.email, token };
}
