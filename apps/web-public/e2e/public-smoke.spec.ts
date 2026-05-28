import { test, expect } from '@playwright/test';

/**
 * Public website smoke suite. Asserts each route returns 200 and renders its
 * shell. Designed to pass with the API up OR down (friendly states), so it
 * needs no seeded database.
 */

test('homepage renders the hero', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  // Phase 7D selector fix: the previous second assertion checked the string
  // "فن العيش الراقي يبدأ من اختيارك الصحيح", which is currently in the
  // page's <meta name="description"> only — never visible content. The
  // first assertion (an h1 in the hero) already proves the hero rendered;
  // dropping the meta-only assertion stabilises the spec without changing
  // any page copy.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
  // Phase 7D selector fix: the empty-state text lives inside an <h3> rendered
  // by EmptyState — getByRole('heading', { name: ... }) waits through React's
  // streaming hydration far more reliably than the previous getByText.
  await expect(
    page.getByRole('heading', { name: 'لم تختر أي وحدات للمقارنة بعد' }),
  ).toBeVisible();
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
