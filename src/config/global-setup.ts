import { rmSync } from 'node:fs';

/** Results directory of the allure reporter; see playwright.config.ts. */
export const ALLURE_RESULTS_DIR = 'allure-results';

/** File under the output directory where the article cleanup records what it could not delete. */
export const LEAK_LOG_NAME = 'leaked-articles.log';

/**
 * The allure reporter creates its results directory but never clears it, so without this
 * every report would mix the current run with all previous ones — including the files that
 * `playwright test --list` leaves behind for tests it never ran.
 */
export default function globalSetup(): void {
  rmSync(ALLURE_RESULTS_DIR, { recursive: true, force: true });
}
