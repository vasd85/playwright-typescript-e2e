import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { SessionFileSchema } from '../api/schemas/user';
import { collectSecrets, redactTextFile, redactTraceZip } from '../reporting/redact-trace';

/**
 * Runs once after all tests, before the reporters write their output: every failure trace
 * and aria snapshot under the output directories loses the credentials it recorded. The
 * worker session files provide the tokens to look for; the traces themselves provide the rest.
 * An archive that cannot be rewritten is removed rather than left behind: the CI artifact is
 * uploaded even after a failed run.
 */
export default function globalTeardown(config: FullConfig): void {
  const outputDirs = [...new Set(config.projects.map((project) => project.outputDir))];
  const traces: string[] = [];
  const contexts: string[] = [];
  const known = new Set<string>();
  for (const dir of outputDirs.filter(existsSync)) {
    for (const relative of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
      const file = path.join(dir, relative);
      const name = path.basename(relative);
      if (name === 'trace.zip') traces.push(file);
      else if (name === 'error-context.md') contexts.push(file);
      else if (relative.startsWith(`.auth${path.sep}`) && name.endsWith('.json')) {
        known.add(SessionFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).token);
      }
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
  for (const context of contexts) replacements += redactTextFile(context, secrets);

  console.log(
    `[redact] ${traces.length} trace(s), ${contexts.length} context file(s), ${replacements} replacement(s)`,
  );
  if (failures.length > 0) {
    throw new Error(`Trace redaction failed, the archives were removed: ${failures.join(', ')}`);
  }
}

/** Removes an archive that could not be redacted and leaves a note without any values. */
function quarantine(trace: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  unlinkSync(trace);
  writeFileSync(
    path.join(path.dirname(trace), 'trace-redaction-failed.txt'),
    `${path.basename(trace)} was removed: it could not be redacted (${reason}).\n`,
  );
  return trace;
}
