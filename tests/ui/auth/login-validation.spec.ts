import { waitForApiResponse } from '../../../src/api/response';
import { ValidationErrorSchema } from '../../../src/api/schemas/errors';
import { uniqueId } from '../../../src/data/unique';
import { buildUser } from '../../../src/data/user.builder';
import { test, expect, NO_AUTH } from '../../../src/fixtures';

// The case begins with a signed-out user: this file opts out of the worker session.
test.use({ storageState: NO_AUTH });

test.describe(
  'Login form validation',
  {
    tag: '@tc-4',
    annotation: [
      { type: 'allure.label.epic', description: 'Authentication' },
      { type: 'allure.label.feature', description: 'Login form validation' },
      { type: 'allure.label.story', description: 'Errors reach the UI from the API' },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    test('rejects wrong credentials with a message from the API', async ({
      loginPage,
      errorMessages,
      page,
    }, testInfo) => {
      // Never registered, so the credentials cannot accidentally be valid.
      const stranger = buildUser(uniqueId(testInfo.parallelIndex));

      await test.step('Open the /login page', async () => {
        await loginPage.goto();
        await expect(loginPage.signInButton).toBeVisible();
      });

      const response = await test.step('Intercept POST **/api/users/login', () =>
        waitForApiResponse(page, 'POST', 'users/login', () => loginPage.login(stranger)));

      await test.step('Validate the rejection response body', async () => {
        expect(response.status(), 'the stand rejects unknown credentials').toBe(401);
        const { errors } = ValidationErrorSchema.parse(await response.json());
        expect(Object.keys(errors), 'the rejection names the credentials').toEqual(['credentials']);
      });

      await test.step('Check the errors shown in the form', async () => {
        await expect(errorMessages.messages).toHaveText(['credentials invalid']);
        await expect(page).toHaveURL('/login');
      });
    });
  },
);
