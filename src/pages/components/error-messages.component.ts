import type { Locator, Page } from '@playwright/test';

/** The validation summary the application shows above a rejected form. */
export class ErrorMessagesComponent {
  // Part of the RealWorld selector contract; the application offers no test id for this list.
  readonly messages: Locator;

  constructor(page: Page) {
    this.messages = page.locator('.error-messages li');
  }
}
