import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

/** Results directory of the allure reporter; see playwright.config.ts. */
export const ALLURE_RESULTS_DIR = 'allure-results';

/** File under the output directory where the article cleanup records what it could not delete. */
export const LEAK_LOG_NAME = 'leaked-articles.log';

/** The allure reporter creates its results directory but never clears it, so runs would pile up. */
export default function globalSetup(): void {
  // The entries rather than the directory itself: under docker compose this directory is a mount
  // point, and removing one fails with EBUSY. Playwright clears its own output directory the same way.
  mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });
  for (const entry of readdirSync(ALLURE_RESULTS_DIR)) {
    rmSync(path.join(ALLURE_RESULTS_DIR, entry), { recursive: true, force: true });
  }
}
