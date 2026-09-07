import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// .env is optional: a missing file is the normal state in CI and in a fresh clone.
// Resolved from the project root rather than the working directory, so any cwd finds it.
// Variables already present in the environment win over the file.
const ENV_FILE = path.resolve(__dirname, '..', '..', '.env');
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// `KEY=` in a .env file yields an empty string, not an absence; both mean "use the default".
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const envSchema = z.object({
  BASE_URL: z.preprocess(emptyToUndefined, z.url().default('https://demo.realworld.show')),
  API_URL: z.preprocess(emptyToUndefined, z.url().default('https://api.realworld.show/api')),
  // Failure-demo mode of the article contract check (TC4): enabled by the value "1" only.
  CONTRACT_FAILURE_DEMO: z
    .preprocess(emptyToUndefined, z.string().optional())
    .transform((value) => value === '1'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses the environment. Missing and empty variables get their defaults;
 * an invalid value throws with the name of the variable.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env: Env = parseEnv();
