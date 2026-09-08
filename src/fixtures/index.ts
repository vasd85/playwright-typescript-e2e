import { mergeTests } from '@playwright/test';
import { test as apiTest } from './api.fixture';
import { test as authTest } from './auth.fixture';
import { test as gateTest } from './gate.fixture';
import { test as pagesTest } from './pages.fixture';

export const test = mergeTests(authTest, pagesTest, gateTest, apiTest);
export { NO_AUTH } from './auth.fixture';
export { expect } from '@playwright/test';
