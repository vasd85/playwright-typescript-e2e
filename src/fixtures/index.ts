import { mergeTests } from '@playwright/test';
import { test as apiTest } from './api.fixture';
import { test as gateTest } from './gate.fixture';
import { test as pagesTest } from './pages.fixture';

// apiTest extends the auth fixture, so the worker session comes in with it.
export const test = mergeTests(pagesTest, gateTest, apiTest);
export { NO_AUTH } from './auth.fixture';
export { expect } from '@playwright/test';
