import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  /** The personal feed tab: the application offers it to a signed-in user only. */
  readonly yourFeedTab: Locator = this.page.getByRole('link', { name: 'Your Feed' });

  async goto(): Promise<void> {
    await this.open('/');
  }
}
