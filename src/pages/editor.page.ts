import { expect, type Locator } from '@playwright/test';
import type { NewArticle } from '../api/schemas/article';
import { BasePage } from './base.page';

export class EditorPage extends BasePage {
  // The form has neither labels nor test ids: the accessible names come from the placeholders.
  readonly titleInput: Locator = this.page.getByRole('textbox', { name: 'Article Title' });
  readonly descriptionInput: Locator = this.page.getByRole('textbox', {
    name: "What's this article about?",
  });
  readonly bodyInput: Locator = this.page.getByRole('textbox', {
    name: 'Write your article (in markdown)',
  });
  readonly tagsInput: Locator = this.page.getByRole('textbox', { name: 'Enter tags' });
  readonly publishButton: Locator = this.page.getByRole('button', { name: 'Publish Article' });
  /** Tags already accepted; the editor page holds this one list, the article page holds another. */
  private readonly tagPills: Locator = this.page.locator('.tag-list span.tag-pill');

  async goto(): Promise<void> {
    await this.open('/editor');
  }

  /**
   * Typing the next tag before the previous one is accepted loses it: measured, one of two tags
   * disappeared in a run that did not wait. Hence the count check between tags.
   */
  async fillForm(article: NewArticle): Promise<void> {
    await this.titleInput.fill(article.title);
    await this.descriptionInput.fill(article.description);
    await this.bodyInput.fill(article.body);
    for (const [index, tag] of article.tagList.entries()) {
      await this.tagsInput.fill(tag);
      await this.tagsInput.press('Enter');
      await expect(this.tagPills).toHaveCount(index + 1);
    }
  }

  async submit(): Promise<void> {
    await this.publishButton.click();
  }
}
