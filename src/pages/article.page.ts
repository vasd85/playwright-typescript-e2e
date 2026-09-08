import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

// The application carries no test ids, so this page is addressed through the RealWorld
// selector contract. Every class-based locator below is scoped to its own container.
export class ArticlePage extends BasePage {
  private readonly banner: Locator = this.page.locator('.banner');
  /** Scoped to the banner: the home page has a heading of its own. */
  readonly title: Locator = this.banner.getByRole('heading', { level: 1 });
  /**
   * Where the markdown lands, and empty when the article body is null. The holder itself has
   * no class of any kind, so its layout column is the only anchor the markup offers.
   */
  readonly body: Locator = this.page.locator('.article-content .col-md-12 > div');
  readonly tags: Locator = this.page.locator('.article-content .tag-list li');
  /** A stray `null` printed as text: what an unguarded corrupted field looks like to a reader. */
  readonly nullText: Locator = this.page.getByText('null', { exact: true });

  /** Scoped to the banner: the same author link is repeated in the footer of the article. */
  authorLink(username: string): Locator {
    return this.banner.getByRole('link', { name: username });
  }

  async goto(slug: string): Promise<void> {
    await this.open(`/article/${slug}`);
  }
}
