import type { Locator } from '@playwright/test';
import type { NewUser } from '../api/schemas/user';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly emailInput: Locator = this.page.getByRole('textbox', { name: 'Email' });
  readonly passwordInput: Locator = this.page.getByRole('textbox', { name: 'Password' });
  readonly signInButton: Locator = this.page.getByRole('button', { name: 'Sign in' });

  async goto(): Promise<void> {
    await this.open('/login');
  }

  async login({ email, password }: Pick<NewUser, 'email' | 'password'>): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}
