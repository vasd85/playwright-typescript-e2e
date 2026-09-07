import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth.fixture';
import { test as pagesTest } from './pages.fixture';

export const test = mergeTests(authTest, pagesTest);
export { NO_AUTH } from './auth.fixture';
export { expect } from '@playwright/test';
