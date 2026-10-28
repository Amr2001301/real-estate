import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * QA1 — the WhatsApp button opens the chat and brings the lead's activity
 * form up on WhatsApp, asking the rep to log how it went.
 */
test('the WhatsApp button opens the chat and the activity form, ready to log it', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const created = await request.post(`${API_BASE}/v1/leads`, {
    headers,
    data: { fullName: `تواصل ${stamp}`, phone: `+2011${stamp}` },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const leadId = ((await created.json()) as { id: string }).id;

  // No real WhatsApp in tests: the chat page answers empty.
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>chat</p>' }));
  await gotoReady(page, `/dashboard/leads/${leadId}`);
  await expect(page.getByTestId('activity-prompt')).toHaveCount(0);

  // The chat opens in a new tab; the form switches to WhatsApp.
  const [chat] = await Promise.all([
    context.waitForEvent('page'),
    page.getByTestId('quick-whatsapp').first().click(),
  ]);
  await chat.waitForURL(new RegExp(`wa\\.me/2011${stamp}`));
  await chat.close();

  await page.waitForURL(/log=WHATSAPP/);
  await expect(page.getByTestId('activity-prompt')).toBeVisible();
  await expect(page.getByTestId('kind-WHATSAPP')).toHaveAttribute('aria-checked', 'true');
});
