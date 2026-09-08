import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { SessionFileSchema } from '../api/schemas/user';
import { collectSecrets, redactTextFile, redactTraceZip } from '../reporting/redact-trace';
import { ALLURE_RESULTS_DIR, LEAK_LOG_NAME } from './global-setup';

/** Extensions of the allure result files that hold text and may quote a credential. */
const ALLURE_TEXT_EXTENSIONS = new Set(['.md', '.json', '.txt']);

/**
 * Runs once after all tests, before the reporters write their output: every failure trace and
 * aria snapshot loses the credentials it recorded, including the copies the allure reporter
 * has already made. An archive that cannot be rewritten is removed rather than left behind.
 */
export default function globalTeardown(config: FullConfig): void {
  const outputDirs = [...new Set(config.projects.map((project) => project.outputDir))];
  const leaks: string[] = [];
  const traces: string[] = [];
  const contexts: string[] = [];
  const known = new Set<string>();
  for (const dir of outputDirs.filter(existsSync)) {
    for (const relative of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
      const file = path.join(dir, relative);
      const name = path.basename(relative);
      if (name === LEAK_LOG_NAME) leaks.push(...readFileSync(file, 'utf8').trim().split('\n'));
      else if (name === 'trace.zip') traces.push(file);
      else if (name === 'error-context.md') contexts.push(file);
      else if (relative.startsWith(`.auth${path.sep}`) && name.endsWith('.json')) {
        known.add(SessionFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).token);
      }
    }
  }

  // The allure reporter copies attachments into its own directory during the run, before this
  // teardown rewrites the originals, so its copies need the same pass.
  if (existsSync(ALLURE_RESULTS_DIR)) {
    for (const name of readdirSync(ALLURE_RESULTS_DIR)) {
      const file = path.join(ALLURE_RESULTS_DIR, name);
      if (name.endsWith('.zip')) traces.push(file);
      else if (ALLURE_TEXT_EXTENSIONS.has(path.extname(name))) contexts.push(file);
    }
  }

  const secrets = collectSecrets([], known);
  const failures: string[] = [];
  let replacements = 0;
  for (const trace of traces) {
    try {
      const result = redactTraceZip(trace, secrets);
      replacements += result.hits;
      for (const secret of result.secrets) secrets.add(secret);
    } catch (error) {
      failures.push(quarantine(trace, error));
    }
  }
  for (const context of contexts) {
    // Same policy as for archives: one file that cannot be redacted must not leave the rest
    // of them unredacted, and it is removed rather than published half-masked.
    try {
      replacements += redactTextFile(context, secrets);
    } catch (error) {
      failures.push(quarantine(context, error));
    }
  }

  console.log(
    `[redact] ${traces.length} archive(s), ${contexts.length} text file(s), ${replacements} replacement(s)`,
  );
  if (failures.length > 0) {
    throw new Error(`Redaction failed, the files were removed: ${failures.join(', ')}`);
  }
  // Data left on the shared stand turns the run red even when the test that created it
  // declared an expected failure and so absorbed its own teardown.
  if (leaks.length > 0) {
    throw new Error(`Cleanup left data on the stand:\n${leaks.join('\n')}`);
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
