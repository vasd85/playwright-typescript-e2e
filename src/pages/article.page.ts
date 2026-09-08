import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ArticlePage extends BasePage {
  private readonly banner: Locator = this.page.locator('.banner');
  readonly title: Locator = this.page.getByRole('heading', { level: 1 });
  /** Where the markdown lands. Stays empty when the article body is null. */
  readonly body: Locator = this.page.locator('.article-content .col-md-12 > div');
  readonly tags: Locator = this.page.locator('.article-content .tag-list li');

  /** Scoped to the banner: the same author link is repeated in the footer of the article. */
  authorLink(username: string): Locator {
    return this.banner.getByRole('link', { name: username });
  }

  async goto(slug: string): Promise<void> {
    await this.open(`/article/${slug}`);
  }
}
