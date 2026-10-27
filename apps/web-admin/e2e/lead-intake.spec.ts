import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * MC2 — the admin makes an intake source; its key is shown once with the
 * webhook address, and a lead posted with it lands as a lead.
 */
test('an intake source is made, its key shown once, and a lead posted with it arrives', async ({ page, request }) => {
  const stamp = Date.now().toString().slice(-8);
  const name = `Pw intake ${stamp}`;

  await gotoReady(page, '/dashboard/campaigns/intake');
  await expect(page.getByTestId('routing-card')).toBeVisible();

  await page.getByTestId('intake-new').click();
  await page.getByTestId('intake-name').fill(name);
  await page.getByTestId('intake-create').click();

  const reveal = page.getByTestId('intake-reveal');
  await expect(reveal).toBeVisible();
  const key = (await reveal.getByTestId('intake-secret').textContent())!.trim();
  const url = (await reveal.getByTestId('intake-url').textContent())!.trim();
  expect(key).toMatch(/^lk_/);
  expect(url).toMatch(/\/v1\/intake\/[^/]+\/leads$/);
  await reveal.getByRole('button').last().click();

  // Listed without the key itself.
  const row = page.getByTestId('intake-key').filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText(key);

  // A source posts a lead with it.
  const slug = url.split('/intake/')[1]!.split('/')[0]!;
  const posted = await request.post(`${API_BASE}/v1/intake/${slug}/leads`, {
    headers: { 'X-Intake-Key': key },
    data: { name: `عميل ${stamp}`, phone: `+2012${stamp}` },
  });
  expect(posted.ok(), await posted.text()).toBe(true);
  expect((await posted.json()).status).toBe('created');

  await page.reload();
  await expect(page.getByTestId('intake-key').filter({ hasText: name })).toContainText('1');
});
