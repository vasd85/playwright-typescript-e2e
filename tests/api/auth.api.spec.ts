import { expectValid } from '../../src/api/expect-valid';
import { ValidationErrorSchema } from '../../src/api/schemas/errors';
import { UserResponseSchema } from '../../src/api/schemas/user';
import { loginUser, registerUser } from '../../src/api/users.api';
import { uniqueId } from '../../src/data/unique';
import { buildUser } from '../../src/data/user.builder';
import { test, expect } from '../../src/fixtures';

test.describe(
  'Conduit API auth',
  {
    tag: '@extra',
    annotation: [
      { type: 'allure.label.epic', description: 'Accounts' },
      { type: 'allure.label.feature', description: 'Conduit API auth' },
      {
        type: 'allure.label.story',
        description: 'Registration and login over HTTP, without a browser',
      },
      { type: 'allure.label.severity', description: 'critical' },
    ],
  },
  () => {
    // No assertion on the 201 here: the fixture hands over the response of a successful
    // registration only, and throws with the status otherwise. That gate is proven by breaking
    // the request path instead.
    test('registers a disposable account', async ({ freshRegistration }) => {
      const { user, response } = freshRegistration;

      await test.step('Validate the registration response body', async () => {
        const { user: created } = await expectValid(
          UserResponseSchema,
          await response.json(),
          'user.json',
        );
        expect(created.username, 'the stand stored the username that was sent').toBe(user.username);
        expect(created.email, 'the stand stored the email that was sent').toBe(user.email);
        expect(created.token, 'the registration answers with a token').not.toBe('');
      });
    });

    test('refuses a registration whose username is already taken', async ({
      freshRegistration,
      apiAsFreshUser,
    }, testInfo) => {
      const taken = {
        ...buildUser(uniqueId(testInfo.parallelIndex)),
        username: freshRegistration.user.username,
      };

      // Sent from the session of that account: an anonymous registration would open a new session,
      // where the name is free and the stand would happily take it.
      const response = await test.step('Register the same username again', () =>
        registerUser(apiAsFreshUser, taken));

      await test.step('Check that the stand refuses the duplicate', async () => {
        expect(response.status(), 'POST /users refuses a taken username').toBe(409);
        const { errors } = await expectValid(
          ValidationErrorSchema,
          await response.json(),
          'errors.json',
        );
        expect(Object.keys(errors), 'only the username is reported').toEqual(['username']);
      });
    });

    test('refuses a registration with blank fields', async ({ request }) => {
      const response = await test.step('Register with every field blank', () =>
        registerUser(request, { username: '', email: '', password: '' }));

      await test.step('Check the validation errors', async () => {
        expect(response.status(), 'POST /users rejects a blank registration').toBe(422);
        const { errors } = await expectValid(
          ValidationErrorSchema,
          await response.json(),
          'errors.json',
        );
        expect(Object.keys(errors).sort(), 'every blank field is reported').toEqual([
          'email',
          'password',
          'username',
        ]);
      });
    });

    test('signs in with the right password', async ({ freshRegistration, request }) => {
      const { user } = freshRegistration;

      const response = await test.step('Sign in with the credentials just registered', () =>
        loginUser(request, { email: user.email, password: user.password }));

      await test.step('Validate the login response body', async () => {
        expect(response.status(), 'POST /users/login accepts the credentials').toBe(200);
        const { user: signedIn } = await expectValid(
          UserResponseSchema,
          await response.json(),
          'user.json',
        );
        expect(signedIn.username, 'the session belongs to the account that signed in').toBe(
          user.username,
        );
      });
    });

    // The worker user is the one account whose password this suite does not know, which is exactly
    // what a wrong-password case needs. A refusal issues no token, so its session stays untouched.
    test('refuses a wrong password', async ({ workerAuth, request }) => {
      const response = await test.step('Sign in with a password that is not the one', () =>
        loginUser(request, { email: workerAuth.email, password: 'not-the-stored-one' }));

      await test.step('Check the refusal', async () => {
        expect(response.status(), 'POST /users/login refuses a wrong password').toBe(401);
        const { errors } = await expectValid(
          ValidationErrorSchema,
          await response.json(),
          'errors.json',
        );
        expect(Object.keys(errors), 'the refusal names the credentials').toEqual(['credentials']);
      });
    });
  },
);
