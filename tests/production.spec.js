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
  await dialog.getByLabel(/^Unloaded/).fill('50');
  await dialog.getByLabel(/^Damaged or unusable/).fill('2');
  await dialog.getByLabel(/^What was wrong/).selectOption('Broken edges/corners');
  await expect(dialog).toContainText('50 arrived − 2 damaged = 48 usable sheet');
  await expect(dialog).toContainText('A claim opens for the difference');
  await dialog.getByRole('button', { name: 'Add usable stock' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel(/^Unloaded/)).toHaveValue('50');
  await dialog.getByRole('button', { name: 'Add usable stock' }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toHaveLength(2);
  expect(calls[0].p_request_id).toBe(calls[1].p_request_id);
  expect(calls[1].p_data).toMatchObject({ id: 801, arrived: '50', damaged: '2', reason: 'Broken edges/corners' });
  // The design's filter chips are toggle buttons; each carries its count, so
  // the name is matched loosely.
  await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: /Claims/ }).click();
  await expect(page.getByRole('main')).toContainText('48 usable');
});

test('finishing a batch sends one transaction and shows 95 good pieces with 45 sheets deducted', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  const batch = { id: 1001, batch_code: 'BATCH-2026-0089', target_product_id: 1, inventory_id: 101, raw_material_id: 701, raw_material_used_qty: 45, target_output_qty: 100, status: 'Quality Check', assigned_staff_id: 1, good_output_qty: 0, damaged_qty: 0 };
  tables.production_batches.push(batch);
  let command;
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    command = route.request().postDataJSON();
    // complete_batch stamps completed_at, which the design's monthly report reads.
    Object.assign(batch, { status: 'Completed', good_output_qty: 95, damaged_qty: 5, completed_by_staff_id: 1, completed_at: new Date().toISOString() });
    tables.inventory[0].stock += 95; tables.raw_materials[0].stock -= 45;
    tables.production_defect_logs.push({ id: 1101, batch_id: 1001, product_id: 1, damaged_quantity: 5, reason: 'Broke during hotwire/cutting', logged_by_staff_id: 1, logged_at: new Date().toISOString() });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(batch) });
  });
  await page.goto(`${baseURL}/production`);
  await page.getByRole('button', { name: 'Count and finish' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Pieces made/).fill('100');
  await dialog.getByLabel(/^Damaged \(/).fill('5');
  await dialog.getByLabel(/^Why pieces were damaged/).selectOption('Broke during hotwire/cutting');
  await expect(dialog).toContainText('adds 95 good pieces');
  await expect(dialog).toContainText('Deducts 45 sheets');
  await expect(dialog).toContainText('Checked by Maria Santos');
  await dialog.getByRole('button', { name: 'Finish batch' }).click();
  await expect(dialog).toHaveCount(0);
  expect(command.p_action).toBe('complete_batch');
  expect(command.p_data).toMatchObject({ id: 1001, produced: '100', damaged: '5', material_qty: 45 });
  await page.goto(`${baseURL}/production-report`);
  // The design's report is by month: this month's totals carry the 95 good
  // pieces, the 5 damaged and the damage rate.
  const totals = page.getByRole('region', { name: / totals$/ });
  await expect(totals).toContainText('Good pieces95');
  await expect(totals).toContainText('Damaged5');
  await expect(totals).toContainText('5.0% of everything made');
});

test('recipe fills material count and adjusts when the target changes', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.goto(`${baseURL}/production`);
  await page.getByRole('button', { name: 'Start batch', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Product/).selectOption('1');
  await dialog.getByLabel(/^How many/).fill('100');
  await expect(dialog.getByLabel(/^Material to set aside/)).toHaveValue('45');
  await dialog.getByLabel(/^How many/).fill('101');
  await expect(dialog.getByLabel(/^Material to set aside/)).toHaveValue('46');
  await dialog.getByLabel(/^Material to set aside/).fill('47');
  await expect(dialog.getByLabel(/^Material to set aside/)).toHaveValue('47');
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
    // The design's floors: 12px text, 28px controls (16px checkboxes, radios
    // and switches are drawn that size on purpose).
    for (const el of root.querySelectorAll('p, label, input, select, button')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (el.matches('[role="checkbox"], [role="radio"], [role="switch"], input[type="checkbox"], input[type="radio"]')) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 12) failures.push(`text too small: ${el.tagName}`);
      if (el.matches('input, select, button') && (rect.height < 27.5 || rect.width < 27.5)) failures.push(`target too small: ${el.tagName}`);
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
  await expect(page.getByRole('button', { name: 'New supplier order', exact: true })).toHaveCount(0);
  await page.goto(`${baseURL}/production-report`);
  await expect(page.getByRole('heading', { name: 'This screen is not part of your job', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('All completed batches')).toHaveCount(0);
});

test('raw material detail survives a reload with the same record', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.goto(`${baseURL}/raw-materials`);
  // The material's side panel links to its full history screen.
  await page.getByRole('button', { name: 'Open Styro Sheet 2 inch' }).click();
  await page.getByRole('button', { name: 'Full history' }).click();
  await expect(page).toHaveURL(`${baseURL}/raw-materials/701`);
  await expect(page.getByRole('main')).toContainText('Where this material was used');
  await page.reload();
  await expect(page.getByRole('main')).toContainText('RAW-2');
  await expect(page.getByRole('main')).toContainText('Where this material was used');
});

test('a supplier with an order still on the way cannot be removed', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  await page.goto(`${baseURL}/suppliers/${tables.suppliers[0].id}`);
  await expect(page.getByRole('button', { name: `Remove ${tables.suppliers[0].name}`, exact: true })).toBeDisabled();
  await expect(page.getByText(/1 order not received yet, so they cannot be removed/)).toBeVisible();
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
    expect(await dialog.getByLabel(/^Product/).inputValue()).not.toBe('');
    expect(Number(await dialog.getByLabel(/^How many/).inputValue())).toBeGreaterThan(0);
    await expect(dialog.getByLabel(/^Made by/)).toHaveValue('3');
  });
}
