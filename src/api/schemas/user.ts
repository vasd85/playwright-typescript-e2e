import { z } from 'zod';

/** The `user` object returned by `POST /users`, `POST /users/login` and `GET /user`. */
export const UserSchema = z.object({
  username: z.string(),
  email: z.string(),
  token: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
});

export const UserResponseSchema = z.object({ user: UserSchema });

/** What a worker keeps on disk between restarts: the identity and the token, never the password. */
export const SessionFileSchema = UserSchema.pick({ username: true, email: true, token: true });

export type User = z.infer<typeof UserSchema>;
export type SessionFile = z.infer<typeof SessionFileSchema>;

/** Credentials of an account to register. */
export type NewUser = { username: string; email: string; password: string };
