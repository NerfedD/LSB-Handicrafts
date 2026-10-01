// Supplemental runbook checks. Browser interaction plus simulated persisted
// readback only; never evidence of hosted authorization or real contention.
import { expect, test } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';
import { SIGNED_IN_EMAIL } from './fixtures.js';

const run = process.env.QA_RUN_ID || 'QA-local-acceptance';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('UI-04/06: keyboard dialog focus stays contained, Escape cancels without a write', async ({ page, baseURL }, info) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  const before = structuredClone(tables.customers);
  const opener = page.getByRole('button', { name: 'Add a customer', exact: true }).first();
  await opener.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/name/i).fill(run + ' cancelled');
  for (const key of [...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
    await page.keyboard.press(key);
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  expect(tables.customers).toEqual(before);
  await info.attach('focus-after-escape', { body: JSON.stringify(await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.getAttribute('aria-label') }))), contentType: 'application/json' });
  await expect.soft(opener).toBeFocused();
  // Continue the independent reset assertion even if focus restoration failed.
  await opener.click();
  await expect(dialog.getByLabel(/name/i)).toHaveValue('');
});

test('UI-07: main destinations at 320px have no document overflow', async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await stubSupabase(page); await signIn(page, baseURL);
  for (const path of ['dashboard', 'orders', 'deliveries', 'products', 'customers', 'suppliers', 'staff', 'raw-materials', 'raw-material-orders', 'production']) {
    await page.goto(`${baseURL}/${path}`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    await info.attach(path + '-width', { body: JSON.stringify(size), contentType: 'application/json' });
    expect.soft(size.scroll, path).toBeLessThanOrEqual(size.width + 1);
  }
});

test('VAL-security: script-like customer names remain text after saving and reloading', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  const name = run + ' <img src=x onerror="window.qaExecuted=true">';
  await page.goto(`${baseURL}/customers`);
  await page.getByRole('button', { name: 'Add a customer', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/name/i).fill(name); await dialog.locator('input[type="tel"]').fill('09171234567');
  await dialog.getByRole('button', { name: 'Add this customer' }).click();
  await expect(dialog).toHaveCount(0);
  expect(tables.customers.filter((row) => row.name === name)).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('main').getByText(name, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.qaExecuted)).toBeUndefined();
  await expect(page.locator('main img[src="x"]')).toHaveCount(0);
});

test('CRUD-03/RACE-05: failed photo save retries only the photo and retains one product and opening count', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  let fail = true;
  await page.route('**/rest/v1/rpc/save_product_image', async (route) => {
    if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA photo save failure' }) });
    await route.fallback();
  });
  const name = run + ' photo';
  await page.goto(`${baseURL}/products/new`);
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('How wide across').fill('4'); await page.getByLabel('Price', { exact: false }).fill('100');
  await page.getByLabel('How many on the shelf now').fill('20');
  await page.getByLabel('Product photo').setInputFiles({ name: run + '.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Photo of ' + name })).toBeVisible();
  await page.getByRole('button', { name: 'Save this product' }).click();
  await expect(page.locator('[data-form-error]')).toContainText(/photo/i);
  const productsBefore = structuredClone(tables.products);
  const inventoryBefore = structuredClone(tables.inventory);
  const historyBefore = structuredClone(tables.stock_movements);
  expect(tables.product_images).toHaveLength(0);
  fail = false;
  await page.getByRole('button', { name: 'Save this product' }).click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  expect.soft(tables.products).toEqual(productsBefore);
  expect.soft(tables.inventory).toEqual(inventoryBefore);
  expect(tables.stock_movements).toEqual(historyBefore);
  expect(tables.products.filter((row) => row.name === name)).toHaveLength(1);
  expect(tables.product_images).toHaveLength(1);
  await page.reload(); await expect(page.getByRole('img', { name: 'Photo of ' + name })).toBeVisible();
});

test('RACE-05: after two failed photo saves a third attempt succeeds without a stale stock conflict', async ({ page, baseURL }, info) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  let photoAttempts = 0;
  await page.route('**/rest/v1/rpc/save_product_image', async (route) => {
    photoAttempts++;
    if (photoAttempts <= 2) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA repeated photo failure' }) });
    await route.fallback();
  });
  const name = run + ' repeated photo';
  await page.goto(`${baseURL}/products/new`);
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('How wide across').fill('4'); await page.getByLabel('Price', { exact: false }).fill('100');
  await page.getByLabel('How many on the shelf now').fill('20');
  await page.getByLabel('Product photo').setInputFiles({ name: run + '.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Photo of ' + name })).toBeVisible();
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByRole('button', { name: 'Save this product' }).click();
    await expect.poll(() => photoAttempts).toBe(attempt);
    await expect(page.locator('[data-form-error]')).toContainText('photo');
  }
  await page.getByRole('button', { name: 'Save this product' }).click();
  // The third attempt is meant to succeed, which leaves this screen -- so wait
  // for that, not for a Save button that is no longer there.
  await expect(page).toHaveURL(/\/products\/\d+$/);
  const evidence = { photoAttempts, products: tables.products.filter((p) => p.name === name), inventory: tables.inventory.filter((p) => p.name === name), images: tables.product_images, error: await page.locator('[data-form-error]').allTextContents() };
  await info.attach('third-photo-attempt', { body: JSON.stringify(evidence), contentType: 'application/json' });
  expect.soft(evidence.products).toHaveLength(1); expect.soft(evidence.inventory).toHaveLength(1);
  expect.soft(evidence.inventory[0].stock).toBe(20);
  await expect(page).toHaveURL(/\/products\/\d+$/);
  expect(photoAttempts).toBe(3);
  await page.reload(); await expect(page.getByRole('img', { name: 'Photo of ' + name })).toBeVisible();
});

for (const role of ['Admin', 'Manager', 'Sales Staff', 'Production Staff', 'Delivery Staff']) {
  test(`AUTH-03: ${role} restricted deep links follow the documented screen matrix`, async ({ page, baseURL }) => {
    const as = 'qa-role@example.test';
    const tables = await stubSupabase(page, { as });
    tables.staff.push({ id: 991, name: run + ' ' + role, email: as, role, status: 'Active', is_super_admin: false, dashboard_view: 'standard' });
    await signIn(page, baseURL, as);
    const manager = ['Admin', 'Manager'].includes(role);
    for (const [path, allowed, heading] of [
      ['products/new', manager, 'Add a product'],
      ['orders/1041/edit', manager, 'Change this order'],
      ['production-report', manager, 'Production report'],
      ['staff', role === 'Admin', 'Staff & accounts'],
      ['customers', role !== 'Production Staff', 'Customers'],
    ]) {
      await page.goto(`${baseURL}/${path}`);
      if (allowed) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      else await expect(page.getByText(/not part of your job|don't have access|do not have access/i).first()).toBeVisible();
    }
  });
}

for (const boundary of [
  { zone: 'America/Los_Angeles', instant: '2026-09-30T16:30:00Z', shopDay: '2026-10-01', chosen: '2026-09-30', valid: false },
  { zone: 'Pacific/Kiritimati', instant: '2026-09-30T12:30:00Z', shopDay: '2026-09-30', chosen: '2026-09-30', valid: true },
]) {
  test.describe('VAL-dates: shop calendar from ' + boundary.zone, () => {
    test.use({ timezoneId: boundary.zone });
    test('promised date uses Asia/Manila even when the device has another day', async ({ page, baseURL }, info) => {
      const tables = await stubSupabase(page);
      // Changing the clock across a calendar boundary must not accidentally
      // turn this date-validation test into an expired-session test.
      await page.route('**/auth/v1/token**', (route) => {
        const expires = Math.ceil(Math.max(Date.now(), Date.parse(boundary.instant)) / 1000) + 86400;
        const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'stub-user', email: SIGNED_IN_EMAIL, exp: expires })}.stub-signature`,
          refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expires,
          user: { id: 'stub-user', email: SIGNED_IN_EMAIL, aud: 'authenticated' },
        }) });
      });
      await signIn(page, baseURL);
      tables.raw_materials.push({ id: 970, sku: run + '-M', name: run + ' sheet', material_type: 'sheet', unit: 'sheet', stock: 0, low_stock_threshold: 0, status: 'Active', revision: 0 });
      let writes = 0;
      await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
        writes++;
        // Model the server rejecting Manila-yesterday. Do not silently allow
        // it just because the client incorrectly regards it as today.
        if (!boundary.valid) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'That date has already passed. Choose today or a later date.' }) });
        const row = { id: 971, ...route.request().postDataJSON().p_data, status: 'Delivery Scheduled', quantity_arrived: 0, quantity_lost_transit: 0, total_cost: 100 };
        tables.raw_material_orders.push(row);
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(row) });
      });
      await page.goto(`${baseURL}/raw-materials`);
      await expect(page.getByRole('group', { name: run + ' sheet' })).toBeVisible();
      await page.clock.setFixedTime(new Date(boundary.instant));
      await page.getByRole('group', { name: run + ' sheet' }).getByRole('button', { name: 'Order more' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Supplier').selectOption({ index: 1 });
      await dialog.getByLabel('How many sheets').fill('2');
      await dialog.getByLabel('Agreed price per unit (₱)').fill('50');
      const date = dialog.getByLabel('Promised delivery date');
      const min = await date.getAttribute('min');
      await date.fill(boundary.chosen);
      await dialog.getByRole('button', { name: 'Place order' }).click();
      await info.attach('timezone-boundary', { body: JSON.stringify({ ...boundary, actualMin: min, writes }), contentType: 'application/json' });
      expect.soft(min).toBe(boundary.shopDay);
      if (boundary.valid) await expect(dialog).toHaveCount(0);
      else {
        expect(writes).toBe(0);
        expect(tables.raw_material_orders).toHaveLength(0);
      }
    });
  });
}
