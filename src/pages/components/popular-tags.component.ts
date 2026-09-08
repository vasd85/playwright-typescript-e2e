import type { Locator, Page } from '@playwright/test';

/** The Popular Tags block of the home page sidebar. */
export class PopularTagsComponent {
  private readonly sidebar: Locator;
  readonly tags: Locator;

  constructor(page: Page) {
    // No test ids in the application, and the home page carries five `.tag-list` containers -
    // one per article preview plus this one. Only the sidebar list is Popular Tags.
    this.sidebar = page.locator('.sidebar');
    this.tags = this.sidebar.locator('.tag-list a');
  }

  tag(name: string): Locator {
    return this.sidebar.getByRole('link', { name });
  }
}
