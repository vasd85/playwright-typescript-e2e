#!/usr/bin/env node
// Reproduces DEF-001: registrations that land in the same integer second of the stand
// share one token, and the extra accounts silently act as somebody else.
// No dependencies: plain Node, run it with `node docs/defects/def-001-repro.mjs`.
//
// Exit codes: 0 no collision, 1 collision reproduced, 2 the measurement did not happen.
// A non-zero 1 means the defect is present, not that the script broke.

import { randomBytes, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

const DEFAULT_API = 'https://api.realworld.show/api';
// The stand is public and shared. Four is the ceiling this project allows per burst.
const MAX_REGISTRATIONS = 4;
const SPREAD_MS = 1000;

/** The measurement never took place: the stand answered something we cannot interpret. */
class MeasurementFailed extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Masks a token down to the form the reports of this project use: token_9b3d…2b2e. */
function mask(token) {
  return `${token.slice(0, 10)}…${token.slice(-4)}`;
}

/** Registers one account. The request carries no Authorization header on purpose: sending
 * a foreign token with a registration breaks that token on this stand. */
async function register(api, username, password) {
  const body = { user: { username, email: `${username}@example.com`, password } };
  let response;
  try {
    response = await fetch(`${api}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new MeasurementFailed(`POST /users for ${username} did not answer: ${cause.message}`);
  }
  if (response.status !== 201) {
    throw new MeasurementFailed(`POST /users for ${username} answered ${response.status}`);
  }
  const payload = await response.json();
  const token = payload?.user?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new MeasurementFailed(`POST /users for ${username} returned no token`);
  }
  return { username, token };
}

/** The username the stand resolves a token to. A dead token (401) is a failed measurement,
 * not a mismatch: only a token that resolves to somebody else proves the collision. */
async function whoami(api, token) {
  let response;
  try {
    response = await fetch(`${api}/user`, { headers: { authorization: `Token ${token}` } });
  } catch (cause) {
    throw new MeasurementFailed(`GET /user did not answer: ${cause.message}`);
  }
  if (response.status !== 200) {
    throw new MeasurementFailed(`GET /user answered ${response.status}`);
  }
  const payload = await response.json();
  const name = payload?.user?.username;
  if (typeof name !== 'string' || name.length === 0) {
    throw new MeasurementFailed('GET /user returned no username');
  }
  return name;
}

/**
 * Registers `n` accounts, then asks who each token belongs to.
 * The identities are checked only after every registration is done: the stand rebinds a
 * shared token to whoever registered last, so checking right after each registration would
 * let the first one pass before the collision happens.
 */
async function burst(api, n, spreadMs, password) {
  const stamp = Math.floor(Date.now() / 1000);
  const suffix = randomBytes(2).toString('hex');
  const names = Array.from({ length: n }, (_, i) => `def001${stamp}${suffix}n${i}`);

  let registered;
  if (spreadMs === 0) {
    registered = await Promise.all(names.map((name) => register(api, name, password)));
  } else {
    registered = [];
    for (const name of names) {
      registered.push(await register(api, name, password));
      await sleep(spreadMs);
    }
  }

  const rows = [];
  for (const { username, token } of registered) {
    rows.push({ username, token, resolved: await whoami(api, token) });
  }
  return rows;
}

/** Prints one measurement and answers whether every identity matched. */
function report(label, rows, requested) {
  console.log(label);
  for (const { username, token, resolved } of rows) {
    const verdict = resolved === username ? 'OK' : 'MISMATCH';
    console.log(
      `POST /users -> 201 username=${username} token=${mask(token)} whoami=${resolved} ${verdict}`,
    );
  }
  // The denominator counts the registrations asked for, not the ones that came back: a
  // smaller denominator would turn rejected registrations into a clean "no collision".
  console.log(`unique tokens: ${new Set(rows.map((r) => r.token)).size} of ${requested}`);
  return rows.every(({ username, resolved }) => resolved === username);
}

async function main() {
  const { values } = parseArgs({
    options: { api: { type: 'string' }, n: { type: 'string' } },
  });
  const api = values.api ?? DEFAULT_API;
  const n = Number(values.n ?? MAX_REGISTRATIONS);
  if (!Number.isInteger(n) || n < 2 || n > MAX_REGISTRATIONS) {
    console.error(`--n must be an integer between 2 and ${MAX_REGISTRATIONS}`);
    return 2;
  }

  // One throwaway password per run, never printed and never stored.
  const password = randomUUID();
  console.log(`stand: ${api}`);

  const parallel = report(
    `\nburst: ${n} registration(s) in parallel — the defect`,
    await burst(api, n, 0, password),
    n,
  );
  const spread = report(
    `\nspread: ${n} registration(s) ${SPREAD_MS / 1000}s apart — the workaround`,
    await burst(api, n, SPREAD_MS, password),
    n,
  );

  console.log(
    `\nverdict: ${parallel && spread ? 'no collision' : 'collision reproduced, see the MISMATCH lines'}`,
  );
  return parallel && spread ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  const reason = error instanceof MeasurementFailed ? error.message : String(error);
  console.error(`measurement failed: ${reason}`);
  process.exitCode = 2;
}
