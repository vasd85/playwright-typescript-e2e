import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { APIRequestContext, PlaywrightTestOptions } from '@playwright/test';
import { SessionFileSchema, UserResponseSchema, type SessionFile } from '../api/schemas/user';
import { getCurrentUser, registerUser } from '../api/users.api';
import { env } from '../config/env';
import { uniqueId } from '../data/unique';
import { buildUser } from '../data/user.builder';

export type StorageState = NonNullable<PlaywrightTestOptions['storageState']>;

export const ATTEMPTS = 3;
// How long after the registration second ends the identity is checked: covers a small clock skew.
const SECOND_BOUNDARY_MARGIN_MS = 300;

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
  return UserResponseSchema.parse(await response.json()).user.username;
}

/** Waits until the second in which the stand answered is over, plus a margin for clock skew. */
export async function waitForNextSecond(respondedAt: number): Promise<void> {
  const boundary = (Math.floor(respondedAt / 1000) + 1) * 1000 + SECOND_BOUNDARY_MARGIN_MS;
  await sleep(Math.max(0, boundary - Date.now()));
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
 * whoever registered last. The identity is therefore checked only after that second has
 * passed, when the binding can no longer change. A mismatch means a collision: a new user is
 * registered in a new second. With `staggerWorkers` set, every attempt first waits for the
 * second reserved for the slot; callers that register sequentially need no stagger.
 */
export async function registerVerified(
  api: APIRequestContext,
  slot: number,
  label: string,
  staggerWorkers?: number,
): Promise<SessionFile> {
  let lastUsername = '';
  let lastWho: string | undefined;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (staggerWorkers !== undefined) await staggerToSlotSecond(slot, staggerWorkers);
    const user = buildUser(uniqueId(slot));
    const response = await registerUser(api, user);
    const respondedAt = Date.now();
    if (response.status() !== 201) {
      throw new Error(`POST /users responded ${response.status()}: ${await response.text()}`);
    }
    const { token } = UserResponseSchema.parse(await response.json()).user;
    await waitForNextSecond(respondedAt);
    const who = await whoAmI(api, token);
    if (who === user.username) {
      console.log(`[auth] ${label} registered=${user.username} attempts=${attempt}`);
      return { username: user.username, email: user.email, token };
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
