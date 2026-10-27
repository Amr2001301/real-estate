import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * CF2 — «خانات العميل الإضافية»: the admin adds a field from the dialog
 * (with its print code shown before saving), hides it with the switch, and
 * adds a ready-made one in one click.
 */
test('the admin adds, hides and picks ready-made customer fields', async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  const en = `Pw field ${stamp}`;
  const key = `pw_field_${stamp}`;
  await gotoReady(page, '/dashboard/company/customer-fields');

  // The dialog: name, type, and the print code made from the English name.
  await page.getByTestId('field-new').click();
  const dialog = page.getByTestId('field-add');
  await dialog.getByTestId('field-ar').fill(`خانة ${stamp}`);
  await dialog.getByTestId('field-en').fill(en);
  await dialog.getByTestId('field-type-SELECT').click();
  await expect(dialog.getByTestId('field-submit')).toBeDisabled(); // a list needs its choices
  await dialog.getByTestId('field-options').fill('أ\nب');
  await expect(dialog).toContainText(`{{custom.${key}}}`);
  await dialog.getByTestId('field-submit').click();

  const row = page.getByTestId(`field-${key}`);
  await expect(row).toContainText(`خانة ${stamp}`);
  await expect(row).toContainText('أ، ب');

  // Hidden from staff, kept on the list.
  await row.getByRole('switch').click();
  await expect(row).toContainText('مخفية');
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

  // A ready-made field, once: it leaves the ready-made list when added.
  const presets = page.getByTestId('field-presets');
  const preset = presets.getByRole('button', { name: /رقم جواز السفر/ });
  if (await preset.isVisible()) {
    await preset.click();
    await expect(page.getByTestId('field-passport_number')).toBeVisible();
  }
  await expect(presets.getByRole('button', { name: /رقم جواز السفر/ })).toHaveCount(0);
});
