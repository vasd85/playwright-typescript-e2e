import { uniqueId } from '../../../src/data/unique';
import { buildUser } from '../../../src/data/user.builder';
import { test, expect, NO_AUTH } from '../../../src/fixtures';

// The registration form needs a signed-out browser: this file opts out of the worker session.
test.use({ storageState: NO_AUTH });

test(
  'a new user signs up, logs out and logs in again',
  { tag: '@tc-1' },
  async ({ registerPage, loginPage, settingsPage, header, gate, page }, testInfo) => {
    const user = buildUser(uniqueId(testInfo.parallelIndex));

    await test.step('Open the /register page', async () => {
      await registerPage.goto();
      await expect(registerPage.signUpButton).toBeDisabled();
    });

    await test.step('Fill the registration form and click Sign up, watching the button state', async () => {
      await registerPage.fillForm(user);
      await expect(registerPage.signUpButton).toBeEnabled();
      const signUp = await gate.hold('POST', 'users');
      await registerPage.submit();
      await signUp.held;
      await expect(registerPage.signUpButton).toBeDisabled();
      signUp.release();
    });

    await test.step('Check that the registration happened: the home page is open and the user is signed in', async () => {
      await expect(page).toHaveURL('/');
      await header.expectSignedInAs(user.username);
    });

    await test.step('Remember the user', async () => {
      await testInfo.attach('remembered-user.json', {
        body: JSON.stringify({ username: user.username, email: user.email }),
        contentType: 'application/json',
      });
    });

    await test.step('Log out through Settings and check that the user is signed out', async () => {
      await header.settingsLink.click();
      await expect(settingsPage.usernameInput).toHaveValue(user.username);
      await expect(settingsPage.emailInput).toHaveValue(user.email);
      await settingsPage.logout();
      await header.expectSignedOut();
    });

    await test.step('Log in and check that the user is signed in', async () => {
      await header.signInLink.click();
      await loginPage.login(user);
      await expect(page).toHaveURL('/');
      await header.expectSignedInAs(user.username);
      await settingsPage.goto();
      await expect(settingsPage.usernameInput).toHaveValue(user.username);
    });
  },
);
