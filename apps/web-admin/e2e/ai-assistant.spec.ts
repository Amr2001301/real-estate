import { expect, test } from '@playwright/test';
import { SALES_STORAGE } from './global-setup';

// AI3 — the assistant chat page. A sales rep reaches it from the sidebar;
// without a model on the server (CI has no ANTHROPIC_API_KEY) it says so and
// takes no question. With the API stubbed, a question and its answer show,
// the answer's table rendered as a table.
test.use({ storageState: SALES_STORAGE });

test.describe('AI assistant chat', () => {
  test('a sales rep sees the page from the nav; without a model it says so', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'المساعد الذكي' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/assistant$/);
    await expect(page.getByRole('heading', { name: 'المساعد الذكي' })).toBeVisible();
    await expect(page.getByTestId('ai-unavailable')).toContainText('غير متاح');
    await expect(page.getByRole('button', { name: 'إرسال' })).toBeDisabled();
  });

  test('a question and its answer show in the chat', async ({ page }) => {
    await page.route('**/api-proxy/ai/status', (r) => r.fulfill({ json: { available: true, reason: null } }));
    let sent: { message?: string; history?: unknown[] } = {};
    await page.route('**/api-proxy/ai/ask', async (r) => {
      sent = r.request().postDataJSON() as typeof sent;
      await r.fulfill({
        json: {
          answer: 'عندك **قسطين** متأخرين:\n\n| العميل | المبلغ |\n|---|---|\n| علي | 5,000 |\n| منى | 7,500 |',
          usage: { used: 1, quota: 10, remaining: 9 },
        },
      });
    });
    await page.goto('/dashboard/assistant');
    await page.evaluate(() => sessionStorage.removeItem('ai-assistant-chat'));
    await page.reload();

    const box = page.getByRole('textbox', { name: 'اكتب سؤالك…' });
    await box.fill('مين عليه أقساط متأخرة؟');
    await page.getByRole('button', { name: 'إرسال' }).click();

    const chat = page.getByTestId('ai-chat');
    await expect(chat.getByText('مين عليه أقساط متأخرة؟')).toBeVisible();
    await expect(chat.getByRole('table')).toBeVisible();
    await expect(chat.getByRole('cell', { name: 'منى' })).toBeVisible();
    await expect(chat.locator('strong', { hasText: 'قسطين' })).toBeVisible();
    expect(sent).toEqual({ message: 'مين عليه أقساط متأخرة؟', history: [] });
    await expect(box).toHaveValue('');
  });

  test('a refused question goes back into the box with the reason', async ({ page }) => {
    await page.route('**/api-proxy/ai/status', (r) => r.fulfill({ json: { available: true, reason: null } }));
    await page.route('**/api-proxy/ai/ask', (r) =>
      r.fulfill({ status: 403, json: { code: 'AI_QUOTA_EXHAUSTED', message: 'x' } }),
    );
    await page.goto('/dashboard/assistant');
    await page.evaluate(() => sessionStorage.removeItem('ai-assistant-chat'));
    await page.reload();
    const box = page.getByRole('textbox', { name: 'اكتب سؤالك…' });
    await box.fill('سؤال');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.getByTestId('ai-chat-error')).toContainText('تم استهلاك كل أسئلة الباقة');
    await expect(box).toHaveValue('سؤال');
    await expect(page.getByTestId('ai-unavailable')).toBeVisible();
  });
});
