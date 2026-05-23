import { test, expect } from '@playwright/test';

/**
 * Public website smoke suite. Asserts each route returns 200 and renders its
 * shell. Designed to pass with the API up OR down (friendly states), so it
 * needs no seeded database.
 */

test('homepage renders the hero', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('فن العيش الراقي يبدأ من اختيارك الصحيح')).toBeVisible();
});

test('projects page renders its hero', async ({ page }) => {
  const res = await page.goto('/projects');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'اكتشف مشاريعنا الاستثنائية' })).toBeVisible();
});

test('units page renders its hero', async ({ page }) => {
  const res = await page.goto('/units');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'وحدات فاخرة جاهزة لاختيارك' })).toBeVisible();
});

test('compare page shows the empty state with no ids', async ({ page }) => {
  const res = await page.goto('/compare');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('لم تختر أي وحدات للمقارنة بعد')).toBeVisible();
});

test('contact page renders the form', async ({ page }) => {
  const res = await page.goto('/contact');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'إرسال الطلب' })).toBeVisible();
});

test('login page renders the email/password form', async ({ page }) => {
  const res = await page.goto('/login');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'دخول إلى الحساب' })).toBeVisible();
});

test('register page renders the account form with terms', async ({ page }) => {
  const res = await page.goto('/register');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'إنشاء الحساب' })).toBeVisible();
  await expect(page.getByText('أوافق على')).toBeVisible();
});

test('sitemap.xml is served', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<urlset');
});

test('robots.txt is served and references the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Sitemap:');
  expect(body).toContain('Disallow: /login');
});
