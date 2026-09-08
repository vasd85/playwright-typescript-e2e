import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  /** The personal feed tab: the application offers it to a signed-in user only. */
  readonly yourFeedTab: Locator = this.page.getByRole('link', { name: 'Your Feed' });
  /** Choosing a tag adds a third feed tab named after it and makes it the active one. */
  readonly activeFeedTab: Locator = this.page.locator('.feed-toggle .nav-link.active');

  async goto(): Promise<void> {
    await this.open('/');
  }
}
