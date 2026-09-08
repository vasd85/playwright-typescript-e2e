import type { Locator, Page } from '@playwright/test';

/** The Popular Tags block of the home page sidebar. */
export class PopularTagsComponent {
  private readonly sidebar: Locator;
  readonly tags: Locator;

  constructor(page: Page) {
    // No test ids in the application, and the class of a tag list is shared with every article
    // preview on the same page, so only the sidebar copy is Popular Tags.
    this.sidebar = page.locator('.sidebar');
    this.tags = this.sidebar.locator('.tag-list a');
  }

  tag(name: string): Locator {
    return this.sidebar.getByRole('link', { name });
  }
}
