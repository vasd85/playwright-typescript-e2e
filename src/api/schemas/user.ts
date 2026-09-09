import { z } from 'zod';

/** The `user` object returned by `POST /users`, `POST /users/login` and `GET /user`. */
const UserSchema = z.object({
  username: z.string(),
  email: z.string(),
  token: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
});

export const UserResponseSchema = z.object({ user: UserSchema });

/**
 * What the authorization flow needs from a registration, a login or `GET /user`: an identity and
 * a token, nothing more. Deliberately not `UserResponseSchema`: the full contract of the user
 * object is what the API tests assert, and parsing it here would make their oracle fire from
 * inside a fixture instead of from the test.
 */
export const AuthUserResponseSchema = z.object({
  user: z.object({ username: z.string(), token: z.string() }),
});

/** What a worker keeps on disk between restarts: the identity and the token, never the password. */
export const SessionFileSchema = UserSchema.pick({ username: true, email: true, token: true });
export type SessionFile = z.infer<typeof SessionFileSchema>;

/** Credentials of an account to register. */
export type NewUser = { username: string; email: string; password: string };
