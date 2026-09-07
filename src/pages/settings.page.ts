import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SettingsPage extends BasePage {
  readonly usernameInput: Locator = this.page.getByRole('textbox', { name: 'Username' });
  readonly emailInput: Locator = this.page.getByRole('textbox', { name: 'Email' });
  readonly logoutButton: Locator = this.page.getByRole('button', {
    name: 'Or click here to logout.',
  });

  async goto(): Promise<void> {
    await this.open('/settings');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
