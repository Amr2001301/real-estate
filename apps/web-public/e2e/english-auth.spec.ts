import { test, expect } from '@playwright/test';

/** QA run 2, public-site sweep (F-064a): the English sign-in and sign-up screens were Arabic. */
test.describe('English sign-in and sign-up', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'site-locale', value: 'en', url: baseURL ?? 'http://localhost:3002' }]);
  });

  test('login speaks English', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to your account' })).toBeVisible();
    await expect(page.getByText('Forgot your password?')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('البريد الإلكتروني');
    await expect(page.locator('main')).not.toContainText('ديفورا');
  });

  test('register speaks English and explains a bad form in English', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'networkidle' });
    await expect(page.getByText('Account details')).toBeVisible();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await expect(page.getByText('Please accept the terms and conditions.')).toBeVisible();
  });

  test('the Arabic site is unchanged', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'دخول إلى الحساب' })).toBeVisible();
    await context.close();
  });
});
