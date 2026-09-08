import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { opendir } from 'node:fs/promises';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { SessionFileSchema } from '../api/schemas/user';
import { collectSecrets, redactTextFile, redactTraceZip } from '../reporting/redact-trace';
import { ALLURE_RESULTS_DIR, LEAK_LOG_NAME } from './global-setup';

/** Extensions of the allure result files that hold text and may quote a credential. */
const ALLURE_TEXT_EXTENSIONS = new Set(['.md', '.json', '.txt']);

type Found = { archives: string[]; texts: string[]; leaks: string[]; tokens: Set<string> };

/** Sorts one file of a project output directory into the list that will handle it. */
function classifyOutputFile(found: Found, dir: string, relative: string): void {
  const file = path.join(dir, relative);
  const name = path.basename(relative);
  if (name === LEAK_LOG_NAME) {
    found.leaks.push(...readFileSync(file, 'utf8').trim().split('\n'));
  } else if (name === 'trace.zip') {
    found.archives.push(file);
  } else if (name === 'error-context.md') {
    found.texts.push(file);
  } else if (relative.startsWith(`.auth${path.sep}`) && name.endsWith('.json')) {
    found.tokens.add(SessionFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).token);
  }
}

/** The allure reporter names its copies by uuid, so they are sorted by extension. */
function classifyAllureFile(found: Found, name: string): void {
  const file = path.join(ALLURE_RESULTS_DIR, name);
  if (name.endsWith('.zip')) found.archives.push(file);
  else if (ALLURE_TEXT_EXTENSIONS.has(path.extname(name))) found.texts.push(file);
}

/**
 * Runs once after all tests, before the reporters write their output: every failure trace and
 * aria snapshot loses the credentials it recorded, including the copies the allure reporter
 * has already made.
 *
 * The reports themselves are still written and the run still explains itself. Only a file that
 * could not be masked is dropped, with a note in its place, and the run exits non-zero naming
 * it: a missing trace is a smaller loss than a published credential.
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  const found: Found = { archives: [], texts: [], leaks: [], tokens: new Set() };

  // Iterated lazily rather than read into one array: an output directory of a long run holds
  // a file per attachment per test.
  for (const dir of [...new Set(config.projects.map((p) => p.outputDir))].filter(existsSync)) {
    for await (const entry of await opendir(dir, { recursive: true })) {
      if (entry.isFile()) {
        classifyOutputFile(found, dir, path.relative(dir, path.join(entry.parentPath, entry.name)));
      }
    }
  }
  // The reporter copies attachments into its own directory during the run, before this teardown
  // rewrites the originals, so its copies need the same pass.
  if (existsSync(ALLURE_RESULTS_DIR)) {
    for await (const entry of await opendir(ALLURE_RESULTS_DIR)) {
      if (entry.isFile()) classifyAllureFile(found, entry.name);
    }
  }

  const secrets = collectSecrets([], found.tokens);
  const failures: string[] = [];
  let replacements = 0;
  // One file that cannot be redacted must not leave the rest of them unredacted.
  for (const archive of found.archives) {
    try {
      const result = redactTraceZip(archive, secrets);
      replacements += result.hits;
      for (const secret of result.secrets) secrets.add(secret);
    } catch (error) {
      failures.push(quarantine(archive, error));
    }
  }
  for (const text of found.texts) {
    try {
      replacements += redactTextFile(text, secrets);
    } catch (error) {
      failures.push(quarantine(text, error));
    }
  }

  console.log(
    `[redact] ${found.archives.length} archive(s), ${found.texts.length} text file(s), ${replacements} replacement(s)`,
  );
  if (failures.length > 0) {
    throw new Error(`Redaction failed, the files were removed: ${failures.join(', ')}`);
  }
  // Data left on the shared stand turns the run red even when the test that created it declared
  // an expected failure and so absorbed the error of its own teardown.
  if (found.leaks.length > 0) {
    throw new Error(`Cleanup left data on the stand:\n${found.leaks.join('\n')}`);
  }
}

/** Removes a file that could not be redacted and leaves a note without any values. */
function quarantine(file: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  unlinkSync(file);
  writeFileSync(
    path.join(path.dirname(file), 'redaction-failed.txt'),
    `${path.basename(file)} was removed: it could not be redacted (${reason}).\n`,
  );
  return file;
}
