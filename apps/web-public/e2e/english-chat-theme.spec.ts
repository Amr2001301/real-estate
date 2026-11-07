import { test, expect } from '@playwright/test';

/**
 * QA run 2, public-site sweep: with the operating system in dark mode every
 * page logged a hydration mismatch (the theme switch's label depended on the
 * browser's theme), and the chat launcher spoke Arabic on the English site.
 */
test.describe('public site: theme switch and chat launcher', () => {
  test('dark mode hydrates without errors', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ colorScheme: 'dark', baseURL });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200));
    });
    await page.goto('/contact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('the English site names the chat launcher in English', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: 'site-locale', value: 'en', url: baseURL ?? 'http://localhost:3002' }]);
    const page = await context.newPage();
    await page.goto('/contact', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Devora AI assistant' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'مساعد ديفورا الذكي' })).toHaveCount(0);
    await context.close();
  });
});
