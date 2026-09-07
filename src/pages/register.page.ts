import type { Locator } from '@playwright/test';
import type { NewUser } from '../api/schemas/user';
import { BasePage } from './base.page';

export class RegisterPage extends BasePage {
  // The form has no labels: the accessible names come from the placeholders.
  readonly usernameInput: Locator = this.page.getByRole('textbox', { name: 'Username' });
  readonly emailInput: Locator = this.page.getByRole('textbox', { name: 'Email' });
  readonly passwordInput: Locator = this.page.getByRole('textbox', { name: 'Password' });
  readonly signUpButton: Locator = this.page.getByRole('button', { name: 'Sign up' });

  async goto(): Promise<void> {
    await this.open('/register');
  }

  async fillForm(user: NewUser): Promise<void> {
    await this.usernameInput.fill(user.username);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
  }

  async submit(): Promise<void> {
    await this.signUpButton.click();
  }
}
