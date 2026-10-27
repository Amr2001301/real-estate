import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * FU1 — follow-ups: on the lead page the rep logs a call, how it went and
 * when to call back; the call shows on the timeline and takes a reply; the
 * lead then shows under «المتابعات».
 */
test('a call with its result and next follow-up is logged, replied to and listed', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const name = `متابعة ${stamp}`;
  const created = await request.post(`${API_BASE}/v1/leads`, {
    headers,
    data: { fullName: name, phone: `+2010${stamp}` },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const leadId = ((await created.json()) as { id: string }).id;

  await gotoReady(page, `/dashboard/leads/${leadId}`);
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-state', 'none');

  // A call nobody answered; call back in three days at 4 pm.
  const composer = page.getByTestId('activity-composer');
  await composer.getByTestId('kind-CALL').click();
  await composer.getByTestId('result-NO_ANSWER').click();
  await composer.getByTestId('activity-body').fill('اتصلت ولم يرد');
  await composer.getByTestId('when-in3').click();
  await composer.getByTestId('next-time').fill('16:00');
  await composer.getByTestId('next-note').fill('إرسال عرض السعر');
  await composer.getByTestId('activity-save').click();

  const item = page.getByTestId('timeline-item').filter({ hasText: 'اتصلت ولم يرد' });
  await expect(item).toContainText('مكالمة');
  await expect(item).toContainText('لم يرد');
  await expect(page.getByTestId('next-action')).toHaveAttribute('data-state', 'upcoming');
  await expect(page.getByTestId('next-action')).toContainText('إرسال عرض السعر');

  // A reply under the call.
  await item.getByTestId('note-reply-open').click();
  await item.getByTestId('note-reply-form').getByRole('textbox').fill('سأعاود الاتصال');
  await item.getByTestId('note-reply-send').click();
  await expect(item.getByTestId('timeline-reply')).toContainText('سأعاود الاتصال');

  // «المتابعات»: upcoming holds the lead.
  await gotoReady(page, '/dashboard/follow-ups?bucket=upcoming');
  await expect(page.getByTestId('follow-row').filter({ hasText: name })).toContainText('إرسال عرض السعر');
});
