import { expect, type Locator, type Page } from '@playwright/test';

/** The navigation bar shared by every page. */
export class HeaderComponent {
  private readonly nav: Locator;
  readonly signInLink: Locator;
  readonly signUpLink: Locator;
  readonly newArticleLink: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation');
    this.signInLink = this.nav.getByRole('link', { name: 'Sign in' });
    this.signUpLink = this.nav.getByRole('link', { name: 'Sign up' });
    this.newArticleLink = this.nav.getByRole('link', { name: 'New Article' });
    this.settingsLink = this.nav.getByRole('link', { name: 'Settings' });
  }

  profileLink(username: string): Locator {
    return this.nav.getByRole('link', { name: username });
  }

  /**
   * Signed in means what the user sees: their profile link and the New Article item.
   * While the current user is still loading the header already shows New Article,
   * so the profile link with the name is the decisive part.
   */
  async expectSignedInAs(username: string): Promise<void> {
    await expect(this.profileLink(username)).toBeVisible();
    await expect(this.newArticleLink).toBeVisible();
  }

  /** Signed out: the guest links are back and the user menu is gone. */
  async expectSignedOut(): Promise<void> {
    await expect(this.signInLink).toBeVisible();
    await expect(this.signUpLink).toBeVisible();
    await expect(this.newArticleLink).toBeHidden();
  }
}
