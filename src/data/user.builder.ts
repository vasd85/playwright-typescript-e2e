import { randomBytes } from 'node:crypto';
import type { NewUser } from '../api/schemas/user';

/** A disposable account: a unique name and email, a random password that is never logged. */
export function buildUser(id: string): NewUser {
  return {
    username: `qa${id}`,
    email: `qa${id}@example.com`,
    password: randomBytes(12).toString('base64url'),
  };
}
