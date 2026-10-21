import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * An admin can tell whether money arrived: every payment shows one state
 * (collected / proof to review / cheque not cleared / rejected / reversed)
 * instead of "verified / unverified" — which read "unverified" on cash the
 * admin recorded, and was a one-click toggle that reversed a paid row.
 */
test.describe('payment states', () => {
  test('payments log shows states, not a verify toggle', async ({ page }) => {
    await gotoReady(page, '/dashboard/deposits');
    const chips = page.getByTestId('deposit-state');
    if ((await chips.count()) === 0) test.skip(true, 'no payments seeded');
    await expect(page.locator('main')).not.toContainText('غير متحقق');
    // The state cell is a label, not a button.
    await expect(page.locator('main tbody button', { hasText: /متحقق|تم التحصيل/ })).toHaveCount(0);
  });

  test('payment proofs are in the sidebar and on the dashboard', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.locator('nav a[href="/dashboard/payments/review"]')).toHaveCount(1);
    await expect(page.locator('main a[href="/dashboard/payments/review"]').first()).toBeVisible();
  });

  test('a reversed payment reads as reversed on the contract, and can be counted again', async ({
    page,
    request,
    context,
  }) => {
    const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
    const list = await (await request.get(`${API_BASE}/v1/deposits?pageSize=50`, { headers })).json();
    const dep = (list.data ?? []).find(
      (d: { state?: string; installmentId?: string | null; contractId?: string | null }) =>
        d.state === 'COLLECTED' && d.installmentId && d.contractId,
    );
    if (!dep) test.skip(true, 'no collected installment payment seeded');

    const rev = await request.post(`${API_BASE}/v1/deposits/${dep.id}/reverse`, {
      headers,
      data: { reason: 'e2e: payment-states' },
    });
    expect(rev.ok()).toBeTruthy();
    try {
      await gotoReady(page, `/dashboard/contracts/${dep.contractId}`);
      // The row says what happened instead of "pending" beside a paid date.
      // (The seed may hold other reversed rows on the same contract.)
      await expect
        .poll(() => page.getByTestId('row-payment-note').filter({ hasText: 'عُكست دفعة' }).count())
        .toBeGreaterThan(0);
      // …with the reason given, on the row and in the statement of account.
      await expect(page.getByTestId('row-reversal-reason').filter({ hasText: 'e2e: payment-states' }).first()).toBeVisible();
      await expect(
        page.locator('[data-testid="statement-line"][data-kind="REVERSAL"]', { hasText: 'e2e: payment-states' }).first(),
      ).toBeVisible();

      await gotoReady(page, `/dashboard/deposits/${dep.id}`);
      await expect(page.getByTestId('deposit-state').first()).toHaveAttribute('data-state', 'REVERSED');
      await expect(page.getByTestId('reversal-details')).toContainText('e2e: payment-states');
      page.once('dialog', (d) => void d.accept());
      await page.getByRole('button', { name: 'إعادة احتساب الدفعة' }).click();
      await expect(page.getByTestId('deposit-state').first()).toHaveAttribute('data-state', 'COLLECTED');
    } finally {
      // Leave the seed as found if the UI step failed part-way.
      const after = await (await request.get(`${API_BASE}/v1/deposits/${dep.id}`, { headers })).json();
      if (after.state === 'REVERSED') {
        await request.patch(`${API_BASE}/v1/deposits/${dep.id}/verify`, { headers, data: { verified: true } });
      }
    }
  });

  test('contract shows a statement of account whose balance is what is left', async ({ page, request, context }) => {
    const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
    const list = await (await request.get(`${API_BASE}/v1/contracts?pageSize=50`, { headers })).json();
    const c = (list.data ?? []).find((x: { installmentPlan?: unknown; status?: string }) => x.status === 'ACTIVE');
    if (!c) test.skip(true, 'no active contract seeded');
    const st = await (await request.get(`${API_BASE}/v1/contracts/${c.id}/statement`, { headers })).json();

    await gotoReady(page, `/dashboard/contracts/${c.id}`);
    await expect(page.getByTestId('statement')).toBeVisible();
    await expect(page.getByTestId('statement-line').first()).toHaveAttribute('data-kind', 'CONTRACT');
    const closing = (await page.getByTestId('statement-closing').innerText()).match(/[\d,]+(\.\d+)?/)?.[0] ?? '';
    expect(Number(closing.replace(/,/g, ''))).toBe(Number(st.totals.balance));
    // Open rows say where they stand against today, never a bare "pending".
    await expect(page.locator('main')).not.toContainText('قيد الانتظار');
  });
});
