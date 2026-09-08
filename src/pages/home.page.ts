import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  /** The personal feed tab: the application offers it to a signed-in user only. */
  readonly yourFeedTab: Locator = this.page.getByRole('link', { name: 'Your Feed' });
  /** The tabs carry no test id and no accessible state, so the class marking them is used. */
  readonly activeFeedTab: Locator = this.page.locator('.feed-toggle .nav-link.active');

  async goto(): Promise<void> {
    await this.open('/');
  }
}
