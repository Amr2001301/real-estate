import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const EMAIL = 'admin@local.test';
const PASS = 'Admin12345!';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  const ctx = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 1. Full viewport dashboard - sidebar + topbar + KPIs
  await page.screenshot({ path: '/tmp/f01_dashboard.png', clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log('✓ f01 dashboard');

  // 2. Sidebar close-up (right side, RTL) — focus the right ~260px
  await page.screenshot({ path: '/tmp/f02_sidebar.png', clip: { x: 1180, y: 0, width: 260, height: 900 } });
  console.log('✓ f02 sidebar');

  // 3. Topbar close-up
  await page.screenshot({ path: '/tmp/f03_topbar.png', clip: { x: 260, y: 0, width: 1180, height: 68 } });
  console.log('✓ f03 topbar');

  // 4. KPI cards band
  await page.screenshot({ path: '/tmp/f04_kpis.png', clip: { x: 260, y: 130, width: 1180, height: 200 } });
  console.log('✓ f04 kpis');

  // 5. Units page — full table section
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/f05_units_full.png' });
  console.log('✓ f05 units');

  // 6. Unit table header + first 3 rows close-up
  const tableEl = await page.$('table');
  if (tableEl) {
    const box = await tableEl.boundingBox();
    if (box) {
      await page.screenshot({ path: '/tmp/f06_table_closeup.png', clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 1180), height: Math.min(box.height, 320) } });
    }
  }
  console.log('✓ f06 table closeup');

  // 7. Hover a table row
  const row = page.locator('tbody tr').nth(1);
  if (await row.count()) {
    await row.hover();
    await page.waitForTimeout(300);
    const rbox = await row.boundingBox();
    if (rbox) {
      await page.screenshot({ path: '/tmp/f07_row_hover.png', clip: { x: Math.max(0, rbox.x - 20), y: Math.max(0, rbox.y - 10), width: Math.min(1180, rbox.width + 40), height: rbox.height + 20 } });
    }
  }
  console.log('✓ f07 row hover');

  // 8. Status badges from reservations (badge-heavy)
  await page.goto(`${BASE}/dashboard/reservations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const badgeEl = page.locator('tbody tr').first();
  if (await badgeEl.count()) {
    const bbox = await badgeEl.boundingBox();
    if (bbox) {
      await page.screenshot({ path: '/tmp/f08_badges_row.png', clip: { x: Math.max(0, bbox.x), y: Math.max(0, bbox.y - 50), width: Math.min(1180, bbox.width), height: bbox.height + 100 } });
    }
  }
  console.log('✓ f08 badges');

  // 9. FilterBar close-up
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const filterEl = await page.$('form, [class*="filter"], [class*="toolbar"]');
  if (filterEl) {
    const fbox = await filterEl.boundingBox();
    if (fbox) {
      await page.screenshot({ path: '/tmp/f09_filterbar.png', clip: { x: Math.max(0, fbox.x - 10), y: Math.max(0, fbox.y - 10), width: Math.min(1180, fbox.width + 20), height: fbox.height + 20 } });
    }
  }
  console.log('✓ f09 filterbar');

  // 10. Input focus state
  await page.goto(`${BASE}/dashboard/clients/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const firstInput = page.locator('input:visible').first();
  if (await firstInput.count()) {
    await firstInput.click();
    await page.waitForTimeout(300);
    const ibox = await firstInput.boundingBox();
    if (ibox) {
      await page.screenshot({ path: '/tmp/f10_input_focus.png', clip: { x: Math.max(0, ibox.x - 40), y: Math.max(0, ibox.y - 60), width: Math.min(900, ibox.width + 80), height: ibox.height + 120 } });
    }
  }
  console.log('✓ f10 input focus');

  // 11. Form full view
  await page.screenshot({ path: '/tmp/f11_form_full.png', fullPage: true });
  console.log('✓ f11 form');

  // 12. Pagination from installments
  await page.goto(`${BASE}/dashboard/installments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const pag = await page.$('nav[aria-label="pagination"]');
  if (pag) {
    const pbox = await pag.boundingBox();
    if (pbox) {
      await page.screenshot({ path: '/tmp/f12_pagination.png', clip: { x: Math.max(0, pbox.x - 10), y: Math.max(0, pbox.y - 10), width: Math.min(1180, pbox.width + 20), height: pbox.height + 20 } });
    }
  }
  console.log('✓ f12 pagination');

  // 13. Buttons
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const header = await page.$('header, [class*="page-header"]');
  if (header) {
    const hbox = await header.boundingBox();
    if (hbox) {
      await page.screenshot({ path: '/tmp/f13_buttons.png', clip: { x: Math.max(0, hbox.x), y: Math.max(0, hbox.y), width: Math.min(1180, hbox.width), height: Math.min(200, hbox.height + 40) } });
    }
  }
  console.log('✓ f13 buttons');

  // 14. Brokers page badges
  await page.goto(`${BASE}/dashboard/brokers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/f14_brokers.png', fullPage: true });
  console.log('✓ f14 brokers');

  // 15. Leads pipeline
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/f15_leads.png' });
  console.log('✓ f15 leads');

  await browser.close();
  console.log('All focus shots done');
}

run().catch(e => { console.error(e.message); process.exit(1); });
