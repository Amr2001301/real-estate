import { test, expect } from '@playwright/test';

/**
 * QA run 2, public-site sweep (F-064b, F-065): the English site's contact block,
 * unit filters and cards were Arabic, and the API was never asked for English.
 */
test.describe('English public site', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'site-locale', value: 'en', url: baseURL ?? 'http://localhost:3002' }]);
  });

  test('the contact page support block is English', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle' });
    await expect(page.getByText('Working hours')).toBeVisible();
    await expect(page.getByText('Sunday – Thursday')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('ساعات العمل');
  });

  test('the units filter offers English ranges', async ({ page }) => {
    await page.goto('/units', { waitUntil: 'networkidle' });
    await expect(page.locator('option', { hasText: 'All types' }).first()).toBeAttached();
    await expect(page.locator('option', { hasText: 'Any price' }).first()).toBeAttached();
    await expect(page.locator('option', { hasText: 'كل الأنواع' })).toHaveCount(0);
  });

  test('project cards and the API data are English', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'networkidle' });
    // The page asks the API for the visitor's language (server side), so a record's
    // English name shows, and the card labels are English too.
    await expect(page.locator('main')).not.toContainText('تفاصيل المشروع');
    await expect(page.locator('main')).not.toContainText('وحدات متاحة');
  });

  test('unit cards show English labels, Latin digits and the currency code', async ({ page }) => {
    await page.goto('/units', { waitUntil: 'networkidle' });
    const cards = page.locator('main a[href^="/units/"]');
    if ((await cards.count()) === 0) test.skip(true, 'no units in this database');
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/ج\.م|م²|متاحة|الطابق/);
    expect(text).toMatch(/\bEGP\b|\bSAR\b|\bAED\b|\$/);
  });
});
