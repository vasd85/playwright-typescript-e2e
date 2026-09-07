import { test as base } from '@playwright/test';
import { HeaderComponent } from '../pages/components/header.component';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { SettingsPage } from '../pages/settings.page';

type PageFixtures = {
  homePage: HomePage;
  registerPage: RegisterPage;
  loginPage: LoginPage;
  settingsPage: SettingsPage;
  header: HeaderComponent;
};

/** Page objects and the shared header as fixtures: a test names the page, never the locator. */
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
  header: async ({ page }, use) => {
    await use(new HeaderComponent(page));
  },
});
