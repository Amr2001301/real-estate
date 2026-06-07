import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const EMAIL = 'admin@local.test';
const PASS = 'Admin12345!';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Full reservations page (badge-heavy)
  await page.goto(`${BASE}/dashboard/reservations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/g01_reservations_viewport.png' });
  console.log('✓ g01 reservations viewport');

  // Table section only
  const table = page.locator('table').first();
  if (await table.count()) {
    const box = await table.boundingBox();
    await page.screenshot({ path: '/tmp/g02_reservations_table.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 400) } });
    console.log('✓ g02 reservations table');
  }

  // Contracts badges
  await page.goto(`${BASE}/dashboard/contracts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const ctable = page.locator('table').first();
  if (await ctable.count()) {
    const cbox = await ctable.boundingBox();
    await page.screenshot({ path: '/tmp/g03_contracts_table.png', clip: { x: cbox.x, y: cbox.y, width: cbox.width, height: Math.min(cbox.height, 350) } });
  }
  console.log('✓ g03 contracts table');

  // Units filterbar
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // The filter bar is a form element or div wrapping selects
  const filterForm = page.locator('form').first();
  if (await filterForm.count()) {
    const fb = await filterForm.boundingBox();
    await page.screenshot({ path: '/tmp/g04_filterbar.png', clip: { x: fb.x - 5, y: fb.y - 5, width: Math.min(1180, fb.width + 10), height: fb.height + 10 } });
    console.log('✓ g04 filterbar');
  }

  // Leads page for stage badges
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/g05_leads_viewport.png' });
  console.log('✓ g05 leads');

  // Brokers - badge variety
  await page.goto(`${BASE}/dashboard/brokers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const btable = page.locator('table').first();
  if (await btable.count()) {
    const bbox = await btable.boundingBox();
    await page.screenshot({ path: '/tmp/g06_brokers_table.png', clip: { x: bbox.x, y: bbox.y, width: bbox.width, height: Math.min(bbox.height, 350) } });
  }
  console.log('✓ g06 brokers table');

  // Pagination
  await page.goto(`${BASE}/dashboard/installments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const pag = page.locator('nav[aria-label="pagination"]');
  if (await pag.count()) {
    const pbox = await pag.boundingBox();
    await page.screenshot({ path: '/tmp/g07_pagination.png', clip: { x: pbox.x - 5, y: pbox.y - 5, width: pbox.width + 10, height: pbox.height + 10 } });
    console.log('✓ g07 pagination');
  }

  // Client form - inputs and selects
  await page.goto(`${BASE}/dashboard/clients/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/g08_form_viewport.png' });
  console.log('✓ g08 form viewport');
  
  // Input focus  
  const visInput = page.locator('input[type="text"]:visible, input:not([type]):visible').first();
  if (await visInput.count()) {
    await visInput.click();
    await page.waitForTimeout(200);
    const ibox = await visInput.boundingBox();
    await page.screenshot({ path: '/tmp/g09_input_focus.png', clip: { x: Math.max(0, ibox.x - 60), y: Math.max(0, ibox.y - 80), width: 700, height: 200 } });
    console.log('✓ g09 input focus');
  }

  // Button close-up
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const btns = page.locator('button:visible, a[class*="button"]:visible').first();
  if (await btns.count()) {
    const bbnbox = await btns.boundingBox();
    await page.screenshot({ path: '/tmp/g10_button.png', clip: { x: Math.max(0, bbnbox.x - 20), y: Math.max(0, bbnbox.y - 20), width: 600, height: 120 } });
    console.log('✓ g10 button');
  }

  // Outline button hover
  const outlineBtns = page.locator('[class*="outline"]:visible, button:has-text("تصدير"):visible, button:has-text("فلاتر"):visible').first();
  if (await outlineBtns.count()) {
    await outlineBtns.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/g11_outline_hover.png' });
    console.log('✓ g11 outline hover');
  }

  // Visits page (appointment badges)
  await page.goto(`${BASE}/dashboard/visits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/g12_visits_viewport.png' });
  console.log('✓ g12 visits');

  await browser.close();
  console.log('Done g-series');
}

run().catch(e => { console.error(e.message); process.exit(1); });
