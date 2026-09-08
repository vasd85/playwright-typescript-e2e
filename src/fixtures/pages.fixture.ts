import { test as base } from '@playwright/test';
import { ArticlePage } from '../pages/article.page';
import { ErrorMessagesComponent } from '../pages/components/error-messages.component';
import { HeaderComponent } from '../pages/components/header.component';
import { PopularTagsComponent } from '../pages/components/popular-tags.component';
import { EditorPage } from '../pages/editor.page';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { SettingsPage } from '../pages/settings.page';

type PageFixtures = {
  homePage: HomePage;
  registerPage: RegisterPage;
  loginPage: LoginPage;
  settingsPage: SettingsPage;
  editorPage: EditorPage;
  articlePage: ArticlePage;
  header: HeaderComponent;
  popularTags: PopularTagsComponent;
  errorMessages: ErrorMessagesComponent;
};

/** Page objects and the shared components as fixtures: a test names the page, never the locator. */
export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },
  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },
  header: async ({ page }, use) => {
    await use(new HeaderComponent(page));
  },
  popularTags: async ({ page }, use) => {
    await use(new PopularTagsComponent(page));
  },
  errorMessages: async ({ page }, use) => {
    await use(new ErrorMessagesComponent(page));
  },
});
