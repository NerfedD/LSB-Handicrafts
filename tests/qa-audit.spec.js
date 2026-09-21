import { expect, test } from '@playwright/test';
import { signIn, stubSupabase } from './stubSupabase.js';

// These test frontend recovery against simulated failures, not hosted RLS.
for (const status of [400, 401, 403, 429, 500]) {
  test(`QA: customer POST ${status} preserves input and allows recovery`, async ({ page, baseURL }) => {
    const tables = await stubSupabase(page);
    await signIn(page, baseURL);
    let fail = true;
    let attempts = 0;
    await page.route('**/rest/v1/customers**', async (route) => {
      if (route.request().method() === 'POST') {
        attempts++;
        if (fail) return route.fulfill({ status, contentType: 'application/json',
          headers: status === 429 ? { 'Retry-After': '1' } : {},
          body: JSON.stringify({ message: `Simulated ${status}` }) });
      }
      await route.fallback();
    });
    await page.goto(`${baseURL}/customers`);
    await page.getByRole('button', { name: 'Add a customer', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    const name = `QA recovery ${status}`;
    await dialog.getByLabel(/name/i).fill(name);
    await dialog.locator('input[type="tel"]').fill('09171234567');
    await dialog.getByRole('button', { name: 'Add this customer' }).click();
    await expect(dialog.locator('[data-form-error]')).toBeVisible();
    await expect(dialog.getByLabel(/name/i)).toHaveValue(name);
    await expect(dialog.getByRole('button', { name: 'Add this customer' })).toBeEnabled();
    expect(tables.customers.filter((row) => row.name === name)).toHaveLength(0);
    fail = false;
    await dialog.getByRole('button', { name: 'Add this customer' }).click();
    await expect(dialog).toHaveCount(0);
    expect(attempts).toBe(2);
    expect(tables.customers.filter((row) => row.name === name)).toHaveLength(1);
  });
}

for (const width of [375, 768, 1440, 2560]) {
  test(`QA: products have no document overflow at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 960 });
    await stubSupabase(page);
    await signIn(page, baseURL);
    await page.goto(`${baseURL}/products`);
    await expect(page.getByRole('heading', { name: 'Products & stock', exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}

for (const [table, label] of [['customers', 'customer'], ['suppliers', 'supplier']]) {
  test(`BUG-001: an open ${label} form keeps its original revision after background refresh`, async ({ page, baseURL }) => {
    const tables = await stubSupabase(page);
    const row = tables[table][0];
    row.contact_number = '09171234567';
    row.revision = 0;
    await signIn(page, baseURL);
    await page.goto(`${baseURL}/${table}/${row.id}`);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill('My unsaved address');
    row.contact_number = '09179876543';
    row.revision = 1;
    const refreshed = page.waitForResponse((response) => response.url().includes(`/rest/v1/${table}`) && response.request().method() === 'GET');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refreshed;
    await dialog.getByRole('button', { name: 'Save the changes' }).click();
    await expect(dialog.locator('[data-form-error]')).toContainText('record changed');
    await expect(dialog.locator('textarea')).toHaveValue('My unsaved address');
    expect(row.contact_number).toBe('09179876543');
    expect(tables[table][0].revision).toBe(1);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await expect(page.getByRole('dialog').locator('input[type="tel"]')).toHaveValue('09179876543');
    await page.getByRole('dialog').locator('textarea').fill('My refreshed address');
    await page.getByRole('dialog').getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(tables[table][0].address).toBe('My refreshed address');
    expect(tables[table][0].contact_number).toBe('09179876543');
    expect(tables[table][0].revision).toBe(2);
  });
}

test('BUG-001: an open product form refuses a newer catalogue revision', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/1/edit`);
  await page.getByLabel('Product name').fill('My stale draft');
  const row = tables.products.find((product) => product.id === 1);
  row.name = 'Newer product name';
  row.revision = 1;
  await page.getByRole('button', { name: 'Save the changes', exact: true }).click();
  await expect(page.locator('[data-form-error]')).toContainText('record changed');
  await expect(page.getByLabel('Product name')).toHaveValue('My stale draft');
  expect(row.name).toBe('Newer product name');
});

test('BUG-001: a product edit cannot overwrite stock changed after the form opened', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/1/edit`);
  await expect(page.getByLabel('Product name')).toHaveValue('Styro Ball 4 inch');
  const stock = tables.inventory.find((row) => row.sku === tables.products[0].item_code);
  stock.stock = 222;
  stock.revision = 1;
  await page.getByRole('button', { name: 'Save the changes', exact: true }).click();
  await expect(page.locator('[data-form-error]')).toContainText('shelf count was not');
  await expect(page.locator('[data-form-error]')).toContainText('record changed');
  expect(tables.inventory.find((row) => row.id === stock.id).stock).toBe(222);
});

// A staff row carries privilege, so a lost update here is not just a lost edit.
// The manage screen sends a WHOLE row, and it refreshes every 30 seconds, so
// without the guard a screen opened before a block writes 'Active' back over it.
test('BUG-005: a stale staff screen cannot undo a block it never saw', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.getByRole('navigation').getByRole('button', { name: /^Staff & accounts/ }).click();
  await page.getByRole('row', { name: /Juan Dela Cruz/ }).getByRole('button', { name: 'Manage' }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Juan Dela Cruz');

  // Another administrator blocks him while this screen sits open.
  const row = tables.staff.find((member) => member.id === 2);
  row.status = 'Blocked';
  row.revision = 1;

  await page.getByLabel('Full name').fill('Juan dela Cruz');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.getByText(/record changed/i)).toBeVisible();
  expect(row.status).toBe('Blocked');
  expect(row.name).toBe('Juan Dela Cruz');
});
