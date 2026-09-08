import type { Page, Response } from '@playwright/test';
import { apiUrl } from '../../../src/api/client';
import { TagsResponseSchema } from '../../../src/api/schemas/tags';
import { test, expect } from '../../../src/fixtures';

/** The tag list the assignment asks for. None of them exists on the stand. */
const MOCKED_TAGS = ['Bitcoin', 'Ethereum', 'Solana', 'USDT'];
const CLICKED_TAG = 'Bitcoin';

const isTagsRequest = (response: Response): boolean =>
  response.url() === apiUrl('tags') && response.request().method() === 'GET';

const mockTags = async (page: Page): Promise<void> => {
  await page.route(apiUrl('tags'), (route) => route.fulfill({ json: { tags: MOCKED_TAGS } }));
};

test.describe(
  'Popular tags',
  {
    tag: '@tc-3',
    annotation: [
      { type: 'allure.label.epic', description: 'Content' },
      { type: 'allure.label.feature', description: 'Popular tags' },
      { type: 'allure.label.story', description: 'The sidebar is isolated from the backend' },
      { type: 'allure.label.severity', description: 'normal' },
    ],
  },
  () => {
    test('shows exactly the mocked tags in the sidebar', async ({
      page,
      homePage,
      popularTags,
    }) => {
      await test.step('Intercept GET **/api/tags and replace the response with the custom tag list', async () => {
        await mockTags(page);
      });

      const response = await test.step('Open the home page', async () => {
        const tags = page.waitForResponse(isTagsRequest);
        await homePage.goto();
        return tags;
      });

      await test.step('Check that the page received the replaced body', async () => {
        expect(
          TagsResponseSchema.parse(await response.json()).tags,
          'the page was served the mocked tags',
        ).toEqual(MOCKED_TAGS);
      });

      await test.step('Check that the Popular Tags block shows the mocked tags, not the real data', async () => {
        await expect(popularTags.tags).toHaveText(MOCKED_TAGS);
      });
    });

    test('opens the tag feed when a mocked tag is clicked', async ({
      page,
      homePage,
      popularTags,
    }) => {
      await test.step('Intercept GET **/api/tags and replace the response with the custom tag list', async () => {
        await mockTags(page);
      });

      await test.step('Open the home page', async () => {
        await homePage.goto();
        await expect(popularTags.tags).toHaveText(MOCKED_TAGS);
      });

      await test.step('Click a mocked tag and check the feed it opens', async () => {
        await popularTags.tag(CLICKED_TAG).click();
        await expect(page).toHaveURL(`/tag/${CLICKED_TAG}`);
        await expect(homePage.activeFeedTab).toHaveText(CLICKED_TAG);
      });
    });
  },
);
