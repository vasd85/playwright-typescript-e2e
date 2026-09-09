import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

/** Results directory of the allure reporter; see playwright.config.ts. */
export const ALLURE_RESULTS_DIR = 'allure-results';

/** File under the output directory where the article cleanup records what it could not delete. */
export const LEAK_LOG_NAME = 'leaked-articles.log';

/**
 * Empties a directory, creating it when it is missing. The entries go, the directory stays: under
 * docker compose it is a bind mount, and removing a mount point fails with EBUSY.
 */
export function clearDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
    for (const entry of readdirSync(dir)) {
      rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
  } catch (cause) {
    throw new Error(
      `Cannot empty the directory "${dir}". In a container it is mounted from the host, and the ` +
        `host may own it as another user; run the service with --user "$(id -u):$(id -g)".`,
      { cause },
    );
  }
}

/** The allure reporter creates its results directory but never clears it, so runs would pile up. */
export default function globalSetup(): void {
  clearDirectory(ALLURE_RESULTS_DIR);
}
