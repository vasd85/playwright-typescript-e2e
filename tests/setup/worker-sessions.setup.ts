import { test as setup, expect } from '@playwright/test';
import { registerVerified, sessionPath, writeSession } from '../../src/auth/worker-session';

// Runs before the browser projects. Every worker slot gets a disposable user of its own here,
// one registration per second: the stand derives a token from the user id and the integer
// second, and every anonymous registration gets the same user id, so registrations that share
// a second share a token. Registering before the tests, one after another, keeps the workers
// apart from each other and from the sign-up and login the registration scenario performs
// through the UI. A browser worker then only reuses the session of its slot.
// Registering here needs no slot stagger - the loop is already sequential - so the budget below
// is per registration, not per collision-retried registration that also waits for its own second.
setup('Register one disposable user per worker slot', async ({ request }, testInfo) => {
  const workers = testInfo.config.workers;
  testInfo.setTimeout(workers * 10_000 + 10_000);
  const tokens = new Set<string>();
  for (let slot = 0; slot < workers; slot += 1) {
    const session = await registerVerified(request, slot, `setup slot=${slot}`);
    writeSession(sessionPath(testInfo.project.outputDir, slot), session);
    tokens.add(session.token);
  }
  expect(tokens.size, 'every slot must hold a token of its own').toBe(workers);
});
