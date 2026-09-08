import { test, expect } from '../../../src/fixtures';

// Every test here starts signed in: the worker fixture registered a user through the API once,
// and the browser context received the token. No login form is involved.
test.describe(
  'Worker session',
  {
    tag: '@arch-1',
    // Allure reads static annotations of the declaration; `allure.label.<name>` is the form
    // that becomes a label, the short `allure.<name>` silently becomes a label named null.
    annotation: [
      { type: 'allure.label.epic', description: 'Authentication' },
      { type: 'allure.label.feature', description: 'Worker session' },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    test('the header shows the worker user without the login form', async ({
      homePage,
      header,
      workerAuth,
    }) => {
      await test.step('Open the home page', async () => {
        await homePage.goto();
      });

      await test.step('Check that the header shows the worker user', async () => {
        await header.expectSignedInAs(workerAuth.username);
      });
    });

    test('the home page offers the personal feed', async ({ homePage }) => {
      await test.step('Open the home page', async () => {
        await homePage.goto();
      });

      await test.step('Check that the Your Feed tab is offered', async () => {
        await expect(homePage.yourFeedTab).toBeVisible();
      });
    });

    test('the settings form is prefilled with the worker user', async ({
      settingsPage,
      workerAuth,
    }) => {
      await test.step('Open the settings page', async () => {
        await settingsPage.goto();
      });

      await test.step("Check that the form holds the worker's username and email", async () => {
        await expect(settingsPage.usernameInput).toHaveValue(workerAuth.username);
        await expect(settingsPage.emailInput).toHaveValue(workerAuth.email);
      });
    });

    test('New Article opens the editor', async ({ homePage, header, page, workerAuth }) => {
      await test.step('Open the home page', async () => {
        await homePage.goto();
      });

      await test.step('Click New Article and check the editor route', async () => {
        await header.newArticleLink.click();
        await expect(page).toHaveURL('/editor');
        await header.expectSignedInAs(workerAuth.username);
      });
    });
  },
);
