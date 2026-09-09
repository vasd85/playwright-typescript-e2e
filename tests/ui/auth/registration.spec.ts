import { uniqueId } from '../../../src/data/unique';
import { buildUser } from '../../../src/data/user.builder';
import { test, expect, NO_AUTH } from '../../../src/fixtures';

// The registration form needs a signed-out browser: this file opts out of the worker session.
test.use({ storageState: NO_AUTH });

// One retry against the token collision of the stand (docs/defects/DEF-001-token-collision.md):
// every other registration answers a collision by verifying the identity and registering again,
// while this scenario cannot - signing up once through the form is what it tests. Measured: this
// value wins over --retries 0 on the command line, and it covers every test added to this file.
test.describe.configure({ retries: 1 });

test(
  'a new user signs up, logs out and logs in again',
  {
    tag: '@tc-1',
    annotation: [
      { type: 'allure.label.epic', description: 'Authentication' },
      { type: 'allure.label.feature', description: 'Registration' },
      { type: 'allure.label.story', description: 'Sign up, sign out, sign in again' },
      { type: 'allure.label.severity', description: 'blocker' },
    ],
  },
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
      await expect(
        settingsPage.usernameInput,
        'the settings form is filled by the server: another name here means the stand rebound our token to someone else (DEF-001), not that the form is broken',
      ).toHaveValue(user.username);
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
      await expect(
        settingsPage.usernameInput,
        'the settings form is filled by the server: another name here means the stand rebound our token to someone else (DEF-001), not that the form is broken',
      ).toHaveValue(user.username);
    });
  },
);
