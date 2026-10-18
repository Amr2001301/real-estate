import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

/**
 * A new company builds its inventory from the dashboard: a project, its phase
 * and its building. The API requires a code on all three; the forms had no
 * code field, so every create failed (an English validation error on the
 * project form, the error page for a phase or a building). A taken code is
 * refused in Arabic under the form.
 */
test.use({ storageState: ADMIN_STORAGE });

const stamp = Date.now().toString().slice(-6);
const PHASE_CODE = `E2E-PH-${stamp}`;
const BUILDING_CODE = `E2E-B-${stamp}`;

test('a project keeps its code on edit; a phase and a building are added with their codes', async ({
  page,
}) => {
  test.setTimeout(90_000);

  // The seeded draft project (the plan's project limit is full, so no new one).
  await page.goto('/dashboard/projects', { waitUntil: 'networkidle' });
  await page
    .getByRole('link', { name: /فيلات الجولف/ })
    .first()
    .click();
  await page.waitForURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/);
  const projectPath = new URL(page.url()).pathname;

  // The edit form shows the code and saves with it.
  await page.goto(`${projectPath}/edit`, { waitUntil: 'networkidle' });
  await expect(page.locator('[name=code]')).toHaveValue('GOLF-VILLAS');
  await page.getByRole('button', { name: 'حفظ التغييرات' }).first().click();
  await expect(page.getByText('تم حفظ التغييرات بنجاح')).toBeVisible();

  // A phase, with its code.
  await page.goto(projectPath, { waitUntil: 'networkidle' });
  await page.getByText('إضافة مرحلة جديدة').click();
  const phaseForm = page.getByTestId('phase-create-form');
  await phaseForm.locator('[name=name_ar]').fill(`مرحلة ${stamp}`);
  await phaseForm.locator('[name=name_en]').fill(`Phase ${stamp}`);
  await phaseForm.locator('[name=code]').fill(PHASE_CODE.toLowerCase());
  await phaseForm.getByRole('button', { name: 'إضافة' }).click();
  const phaseCard = page
    .locator('div')
    .filter({ hasText: `مرحلة ${stamp}` })
    .filter({ has: page.getByText('إضافة مبنى') })
    .last();
  await expect(phaseCard).toBeVisible();

  // A building in that phase, with its code.
  await phaseCard.getByText('إضافة مبنى').click();
  const buildingForm = phaseCard.getByTestId('building-create-form');
  await buildingForm.locator('[name=name]').fill(`E2E${stamp}`);
  await buildingForm.locator('[name=code]').fill(BUILDING_CODE);
  await buildingForm.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText(`مبنى E2E${stamp}`)).toBeVisible();

  // A second phase with the same code is refused in Arabic, on the page.
  // (The "add phase" <details> stays open after the first add.)
  await page
    .locator('details')
    .filter({ has: page.getByTestId('phase-create-form') })
    .evaluate((d) => d.setAttribute('open', ''));
  const again = page.getByTestId('phase-create-form');
  await again.locator('[name=name_ar]').fill(`مكررة ${stamp}`);
  await again.locator('[name=name_en]').fill(`Duplicate ${stamp}`);
  await again.locator('[name=code]').fill(PHASE_CODE);
  await again.getByRole('button', { name: 'إضافة' }).click();
  await expect(again.getByRole('alert')).toContainText('هذا الكود مستخدم بالفعل');
  await expect(page.getByText(`Duplicate ${stamp}`)).toHaveCount(0);
});
