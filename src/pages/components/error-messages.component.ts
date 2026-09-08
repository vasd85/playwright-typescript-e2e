import type { Locator, Page } from '@playwright/test';

/** The validation summary the application shows above a rejected form. */
export class ErrorMessagesComponent {
  // The application offers no test id for this list; the class is what the markup gives us.
  readonly messages: Locator;

  constructor(page: Page) {
    this.messages = page.locator('.error-messages li');
  }
}
