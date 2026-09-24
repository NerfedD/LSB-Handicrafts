import { expect, test } from '@playwright/test';

import { signIn, stubSupabase } from './stubSupabase.js';

// Damage, count corrections, replacements and the loyalty reward, end to end
// against the stubbed API. The database rules behind them are proved against
// the real schema in src/utils/*Database.test.js; these prove the screens
// send the right request, show the result and hide what a role cannot do.

const SALES = 'juan@lsbhandicrafts.test';

async function openProduct(page, baseURL, name) {
  await page.goto(`${baseURL}/products`);
  await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('On the shelf right now')).toBeVisible();
}

test('damaged stock comes off the shelf once, with a reason, and shows in the stock history', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  const calls = [];
  page.on('request', (request) => {
    if (request.url().includes('/rpc/stock_command')) calls.push(request.postDataJSON());
  });
  await signIn(page, baseURL);
  await openProduct(page, baseURL, 'Styro Ball 4 inch');

  await page.getByRole('button', { name: 'Record damage' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('How many are damaged').fill('3');
  await dialog.getByLabel('What happened').selectOption('broken');
  await dialog.getByLabel('Note').fill('Dropped by the loading bay');
  await expect(dialog).toContainText('140 − 3 damaged = 137 left on the shelf.');
  await dialog.getByRole('button', { name: 'Write it off' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('The damaged stock was written off.')).toBeVisible();
  expect(tables.inventory.find((row) => row.sku === 'SB-040').stock).toBe(137);
  expect(calls).toEqual([expect.objectContaining({
    p_action: 'record_damage',
    p_data: expect.objectContaining({ target: 'product', id: 101, quantity: '3', reason: 'broken' }),
  })]);
  const history = page.getByRole('table', { name: /Every change to this stock count/ });
  await expect(history.getByText('Written off as damaged')).toBeVisible();
  await expect(history.getByText(/Broken or cracked · Dropped by the loading bay/)).toBeVisible();
});

test('a damage record entered wrong is put back once, and stays on the record', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await openProduct(page, baseURL, 'Styro Ball 4 inch');

  await page.getByRole('button', { name: 'Record damage' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('How many are damaged').fill('5');
  await dialog.getByLabel('What happened').selectOption('handling');
  await dialog.getByRole('button', { name: 'Write it off' }).click();
  await expect(dialog).toHaveCount(0);
  expect(tables.inventory.find((row) => row.sku === 'SB-040').stock).toBe(135);

  const history = page.getByRole('table', { name: /Every change to this stock count/ });
  const damaged = history.getByRole('row', { name: /Written off as damaged/ });
  await damaged.getByRole('button', { name: 'Put this back' }).click();

  await expect(page.getByText('The damaged stock was put back.')).toBeVisible();
  expect(tables.inventory.find((row) => row.sku === 'SB-040').stock).toBe(140);
  // Both the mistake and the correction stay on the record, and the offer goes.
  await expect(history.getByText('Damage record undone')).toBeVisible();
  await expect(history.getByText('Written off as damaged')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Put this back' })).toHaveCount(0);
  await expect(history.getByText('Already put back')).toBeVisible();
});

test('only a manager or administrator is offered the undo', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page, { as: SALES });
  // A damage record to offer: without one the history is empty and the test
  // would pass on an empty screen rather than on the role.
  tables.stock_movements.push({
    id: 9001, inventory_id: 101, raw_material_id: null, item_code: 'SB-040',
    item_name: 'Styro Ball 4 inch', quantity_change: -4, balance_after: 136, kind: 'damage',
    reason: 'broken', note: null, order_id: null, supplier_order_id: null, batch_id: null,
    actor_staff_id: 1, actor_name: 'Maria Santos', created_at: new Date().toISOString(),
  });
  await signIn(page, baseURL, SALES);
  await openProduct(page, baseURL, 'Styro Ball 4 inch');

  const history = page.getByRole('table', { name: /Every change to this stock count/ });
  await expect(history.getByText('Written off as damaged')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Put this back' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Entered wrong?' })).toHaveCount(0);
});

test('a count correction refuses to overwrite a count that moved after the form opened', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await openProduct(page, baseURL, 'Styro Ball 4 inch');

  await page.getByRole('button', { name: 'Correct the count' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('How many are actually there').fill('150');
  await dialog.getByLabel('Why it is being corrected').selectOption('recount');
  // Somebody else's change lands while the form is open.
  tables.inventory.find((row) => row.sku === 'SB-040').stock = 139;
  await dialog.getByRole('button', { name: 'Save the count' }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed since you opened this');
  expect(tables.inventory.find((row) => row.sku === 'SB-040').stock).toBe(139);
});

test('sales staff can look at stock but not change it, the product or its price', async ({ page, baseURL }) => {
  await stubSupabase(page, { as: SALES });
  await signIn(page, baseURL, SALES);
  await openProduct(page, baseURL, 'Styro Ball 4 inch');

  await expect(page.getByRole('button', { name: 'Record damage' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Correct the count' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit this product' })).toHaveCount(0);

  await page.goto(`${baseURL}/products`);
  await expect(page.getByRole('button', { name: 'Add a product' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);

  await page.goto(`${baseURL}/products/1/edit`);
  await expect(page.getByText(/not part of your job|don't have access|do not have access/i).first()).toBeVisible();
});

test('damaged goods on a delivered order are replaced instead of refunded, and no money moves', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1043`);
  await expect(page.getByRole('heading', { name: 'Bloom & Co' })).toBeVisible();

  await page.getByRole('button', { name: 'Replace goods' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/How many Styro Ball 6 inch came back/).fill('2');
  await dialog.getByRole('radio', { name: /Thrown away/ }).click();
  await dialog.getByRole('radio', { name: /Broken or damaged/ }).click();
  await dialog.getByRole('button', { name: 'Record the replacement' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Replacement recorded on order #1043.')).toBeVisible();
  const returns = page.getByRole('main');
  await expect(returns.getByText('Replaced: 2 × Styro Ball 6 inch sent out')).toBeVisible();
  await expect(returns.getByText(/2 × Styro Ball 6 inch came back — thrown away/)).toBeVisible();

  const order = tables.orders.find((row) => row.id === 1043);
  expect(Number(order.refunded_amount ?? 0)).toBe(0);
  expect(order.status).toBe('Completed');
  // 12 on the shelf, the scrapped pair does not go back, the replacement leaves.
  expect(tables.inventory.find((row) => row.sku === 'SB-060').stock).toBe(10);
});

test('an order not yet delivered offers no replacement', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1042`);
  await expect(page.getByRole('heading', { name: 'Money on this order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace goods' })).toHaveCount(0);
});

test('a manager switches the loyalty reward on, and a new order for a regular applies it', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  const posted = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/orders')) posted.push(request.postDataJSON());
  });
  await signIn(page, baseURL);

  await page.goto(`${baseURL}/customers`);
  await page.getByRole('button', { name: 'Loyalty rules' }).click();
  const rules = page.getByRole('dialog');
  await rules.getByLabel('Give the loyalty reward').selectOption('yes');
  await rules.getByLabel('The reward starts after').fill('1');
  await rules.getByLabel('The reward, as a percentage off the items').fill('10');
  await rules.getByRole('button', { name: 'Save the rules' }).click();
  await expect(rules).toHaveCount(0);
  expect(tables.loyalty_rules[0]).toMatchObject({ enabled: true, reward_after_orders: 1, reward_percent: 10 });
  // Bloom & Co has one finished order (#1043).
  await expect(page.getByRole('radio', { name: /Loyalty reward/ })).toContainText('1');

  await page.goto(`${baseURL}/orders/new`);
  // Scoped to <main>: the sidebar's Customers button would match first.
  const form = page.getByRole('main');
  await form.getByLabel(/^Customer/).fill('Bloom & Co');
  await expect(form.getByText('Bloom & Co has earned the loyalty reward')).toBeVisible();
  await form.getByLabel('Item').click();
  await page.getByRole('option', { name: /Styro Ball 4 inch/ }).click();
  await form.getByLabel('How many').fill('10');
  await form.getByLabel('Where to').fill('3 Torres St, Poblacion, Davao City');
  // 10 × ₱120 = ₱1,200, less 10%.
  await expect(page.getByText('−₱120.00 on this order.')).toBeVisible();
  await page.getByRole('button', { name: 'Write this order' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'One order' })).toBeVisible();
  expect(posted[0]).toMatchObject({ customer_id: 204, discount_amount: 120, total_amount: 1080, promotion: { kind: 'loyalty' } });
  await expect(page.getByRole('main').getByText('Loyalty reward').first()).toBeVisible();
});

test('production staff do not see customers at all', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page, { as: 'ana@lsbhandicrafts.test' });
  tables.staff.find((row) => row.email === 'ana@lsbhandicrafts.test').status = 'Active';
  const read = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/rest/v1/customers')) read.push(request.url());
  });
  await signIn(page, baseURL, 'ana@lsbhandicrafts.test');
  await expect(page.getByRole('button', { name: /Customers/ })).toHaveCount(0);
  expect(read).toEqual([]);
});

test('raw materials at or below their reorder point are one filter away', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  tables.raw_materials.push(
    { id: 701, sku: 'RAW-1', name: 'Styro Sheet 1 inch', material_type: 'sheet', unit: 'sheet', stock: 20, low_stock_threshold: 20 },
    { id: 702, sku: 'RAW-2', name: 'Styro Sheet 2 inch', material_type: 'sheet', unit: 'sheet', stock: 90, low_stock_threshold: 20 },
  );
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/raw-materials`);
  await page.getByRole('radio', { name: /Needs ordering/ }).click();
  await expect(page.getByText('Styro Sheet 1 inch')).toBeVisible();
  await expect(page.getByText('Styro Sheet 2 inch')).toHaveCount(0);
});
