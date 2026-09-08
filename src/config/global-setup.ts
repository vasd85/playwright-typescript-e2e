import { rmSync } from 'node:fs';

/** Where the allure-playwright reporter writes one file per test; see playwright.config.ts. */
export const ALLURE_RESULTS_DIR = 'allure-results';

/**
 * Runs once before all tests. The reporter creates its results directory but never clears
 * it (allure-js-commons FileSystemWriter only makes the directory), so without this every
 * report would mix the current run with all previous ones — including the files that
 * `playwright test --list` leaves behind for tests it never ran.
 */
export default function globalSetup(): void {
  rmSync(ALLURE_RESULTS_DIR, { recursive: true, force: true });
}
