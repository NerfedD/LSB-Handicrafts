import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';

async function setup(page, baseURL, as, configure) {
  const tables = await stubSupabase(page, as ? { as } : {});
  tables.raw_materials.push({ id: 701, sku: 'RAW-2', name: 'Styro Sheet 2 inch', material_type: 'sheet', unit: 'sheet', stock: 48, low_stock_threshold: 20 });
  tables.raw_material_orders.push({ id: 801, supplier_id: tables.suppliers[0].id, raw_material_id: 701, quantity_ordered: 50, unit_price: 100, total_cost: 5000, status: 'In Transit', expected_delivery_date: '2026-09-19', quantity_arrived: 0, quantity_lost_transit: 0, claim_status: 'None' });
  tables.production_recipes.push({ id: 901, product_id: 1, raw_material_id: 701, material_qty: 45, output_qty: 100 });
  configure?.(tables);
  await signIn(page, baseURL, as);
  return tables;
}

test('receiving shows usable math and preserves its request key after a network failure', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  tables.raw_materials[0].stock = 0;
  const calls = [];
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    const body = route.request().postDataJSON(); calls.push(body);
    if (calls.length === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable' }) });
    const order = tables.raw_material_orders[0];
    Object.assign(order, { status: 'Arrived', quantity_arrived: 50, quantity_lost_transit: 2, quantity_usable: 48, claim_status: 'Needs review', received_by_staff_id: 1 });
    tables.raw_materials[0].stock = 48;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(order) });
  });
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: 'Receive delivery', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quantity physically unloaded').fill('50');
  await dialog.getByLabel('Nasira sa byahe').fill('2');
  await dialog.getByLabel('What happened on the way?').selectOption('Broken edges/corners');
  await expect(dialog).toContainText('50 arrived − 2 damaged = 48 usable sheet');
  await expect(dialog).toContainText('Supplier claim flagged for manager review');
  await dialog.getByRole('button', { name: 'Accept usable stock' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Quantity physically unloaded')).toHaveValue('50');
  await dialog.getByRole('button', { name: 'Accept usable stock' }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toHaveLength(2);
  expect(calls[0].p_request_id).toBe(calls[1].p_request_id);
  expect(calls[1].p_data).toMatchObject({ id: 801, arrived: '50', damaged: '2', reason: 'Broken edges/corners' });
  // The filter row is a radiogroup, like every other list screen's: one choice
  // among several, which is what lets arrow keys move between the chips. Each
  // chip also carries its count, so the name is matched loosely.
  await page.getByRole('radio', { name: /Supplier claims/ }).click();
  await expect(page.getByRole('main')).toContainText('48 usable');
});

test('finishing a batch sends one transaction and shows 95 good pieces with 45 sheets deducted', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  const batch = { id: 1001, batch_code: 'BATCH-2026-0089', target_product_id: 1, inventory_id: 101, raw_material_id: 701, raw_material_used_qty: 45, target_output_qty: 100, status: 'Quality Check', assigned_staff_id: 1, good_output_qty: 0, damaged_qty: 0 };
  tables.production_batches.push(batch);
  let command;
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    command = route.request().postDataJSON();
    Object.assign(batch, { status: 'Completed', good_output_qty: 95, damaged_qty: 5, completed_by_staff_id: 1 });
    tables.inventory[0].stock += 95; tables.raw_materials[0].stock -= 45;
    tables.production_defect_logs.push({ id: 1101, batch_id: 1001, product_id: 1, damaged_quantity: 5, reason: 'Broke during hotwire/cutting', logged_by_staff_id: 1, logged_at: new Date().toISOString() });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(batch) });
  });
  await page.goto(`${baseURL}/production`);
  await page.getByRole('button', { name: 'Finish batch & quality check' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Total pieces produced').fill('100');
  await dialog.getByLabel('Ilan ang nasira?').fill('5');
  await dialog.getByLabel('Why were they damaged?').selectOption('Broke during hotwire/cutting');
  await expect(dialog).toContainText('Processed: 100 − Nasira: 5 = 95 pieces to shelf');
  await expect(dialog).toContainText('Deduct 45 sheet');
  await expect(dialog).toContainText('Checked and approved by Maria Santos');
  await dialog.getByRole('button', { name: 'Finish batch and update stock' }).click();
  await expect(dialog).toHaveCount(0);
  expect(command.p_action).toBe('complete_batch');
  expect(command.p_data).toMatchObject({ id: 1001, produced: '100', damaged: '5', material_qty: 45 });
  await page.goto(`${baseURL}/production-report`);
  // The report's headline figures are stat tiles rather than a sentence, so the
  // same three facts are asserted where they now live.
  const report = page.getByRole('main');
  await expect(report).toContainText('of 100 processed');
  await expect(report).toContainText('5.0% of what was made');
  await expect(report).toContainText('95.0%');
});

test('recipe fills material count and adjusts when the target changes', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.goto(`${baseURL}/production`);
  await page.getByRole('button', { name: 'Start batch', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What are we making?').selectOption('1');
  await dialog.getByLabel('Target pieces').fill('100');
  await expect(dialog.getByLabel('Material to set aside')).toHaveValue('45');
  await dialog.getByLabel('Target pieces').fill('101');
  await expect(dialog.getByLabel('Material to set aside')).toHaveValue('46');
  await dialog.getByLabel('Material to set aside').fill('47');
  await expect(dialog.getByLabel('Material to set aside')).toHaveValue('47');
});

test('phone receiving form has readable text, large controls and no horizontal overflow', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, baseURL);
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: 'Receive delivery', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.evaluate((root) => Promise.all(root.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))));
  const violations = await dialog.evaluate((root) => {
    const failures = [];
    for (const el of root.querySelectorAll('p, label, input, select, button')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 16) failures.push(`text too small: ${el.tagName}`);
      if (el.matches('input, select, button') && (rect.height < 44 || rect.width < 44)) failures.push(`target too small: ${el.tagName}`);
    }
    if (root.scrollWidth > root.clientWidth + 1) failures.push('horizontal overflow');
    return failures;
  });
  expect(violations).toEqual([]);
  await page.screenshot({ path: 'test-results/workshop-phone.png' });
});

test('sales can receive supplies but cannot order or open production reports', async ({ page, baseURL }) => {
  await setup(page, baseURL, 'juan@lsbhandicrafts.test');
  await page.goto(`${baseURL}/raw-material-orders`);
  await expect(page.getByRole('button', { name: 'Receive delivery', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Order materials', exact: true })).toHaveCount(0);
  await page.goto(`${baseURL}/production-report`);
  await expect(page.getByRole('heading', { name: 'This screen is not part of your job', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('All completed batches')).toHaveCount(0);
});

test('raw material detail survives a reload with the same record', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.goto(`${baseURL}/raw-materials`);
  await page.getByRole('button', { name: 'View material', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/raw-materials/701`);
  await expect(page.getByRole('main')).toContainText('Where this material was used');
  await page.reload();
  await expect(page.getByRole('main')).toContainText('RAW-2');
  await expect(page.getByRole('main')).toContainText('Where this material was used');
});

test('a supplier with purchasing history cannot be removed', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  await page.goto(`${baseURL}/suppliers/${tables.suppliers[0].id}`);
  await expect(page.getByRole('button', { name: `Remove ${tables.suppliers[0].name}`, exact: true })).toBeDisabled();
  await expect(page.getByText(/purchasing history, so they cannot be removed/)).toBeVisible();
  // The heading has to agree with the disabled button under it, rather than
  // going on offering an action the rest of the block refuses.
  await expect(page.getByRole('heading', { name: 'This supplier stays on file' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remove this supplier for good' })).toHaveCount(0);
});

for (const view of ['standard', 'large']) {
  test(`production dashboard starts a prefilled batch (${view})`, async ({ page, baseURL }) => {
    await setup(page, baseURL, 'ana@lsbhandicrafts.test', (tables) => {
      tables.staff[2].status = 'Active'; tables.staff[2].dashboard_view = view;
    });
    const productRow = page.locator('tr, li').filter({ has: page.getByRole('button', { name: 'Start batch', exact: true }) }).first();
    await expect(productRow).toBeVisible();
    await productRow.getByRole('button', { name: 'Start batch', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.getByLabel('What are we making?').inputValue()).not.toBe('');
    expect(Number(await dialog.getByLabel('Target pieces').inputValue())).toBeGreaterThan(0);
    await expect(dialog.getByLabel('Who will make it?')).toHaveValue('3');
  });
}
