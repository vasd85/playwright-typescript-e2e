import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

// The application carries no test ids, so the class-based locators below are what the markup
// gives us; each one is scoped to its own container.
export class ArticlePage extends BasePage {
  private readonly banner: Locator = this.page.locator('.banner');
  /** Scoped to the banner: the home page has a heading of its own. */
  readonly title: Locator = this.banner.getByRole('heading', { level: 1 });
  /** Everything a reader sees below the banner: the rendered body and the tags of the article. */
  readonly content: Locator = this.page.locator('.article-content');
  /**
   * Where the markdown lands, and empty when the article body is null. The holder itself has
   * no class of any kind, so its layout column is the only anchor the markup offers.
   */
  readonly body: Locator = this.content.locator('.col-md-12 > div');
  readonly tags: Locator = this.content.locator('.tag-list li');

  /** Scoped to the banner: the same author link is repeated in the footer of the article. */
  authorLink(username: string): Locator {
    return this.banner.getByRole('link', { name: username });
  }

  async goto(slug: string): Promise<void> {
    await this.open(`/article/${slug}`);
  }
}
