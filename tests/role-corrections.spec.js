import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';

// Who can undo what on a production batch, and the way back for supplier
// orders, recipes and suppliers. The database enforces the same lists
// (src/utils/correctionsDatabase.test.js); these pin the buttons to them.

const ADMIN = 'maria.santos@lsbhandicrafts.test';
const MANAGER = 'grace@lsbhandicrafts.test';
const PRODUCTION = 'ana@lsbhandicrafts.test';

const BATCH = { id: 1001, batch_code: 'BATCH-2026-0101', target_product_id: 1, inventory_id: 101, raw_material_id: 701,
  raw_material_used_qty: 45, target_output_qty: 100, assigned_staff_id: 3, good_output_qty: 0, damaged_qty: 0 };

async function setup(page, baseURL, as, configure) {
  const tables = await stubSupabase(page, { as });
  tables.staff[2].status = 'Active';
  tables.staff.push({ id: 5, name: 'Grace Lim', role: 'Manager', contact_number: '0917 555 0105', status: 'Active',
    email: MANAGER, username: 'grace', is_super_admin: false, dashboard_view: 'standard' });
  tables.raw_materials.push({ id: 701, sku: 'RAW-2', name: 'Styro Sheet 2 inch', material_type: 'sheet', unit: 'sheet', stock: 48, low_stock_threshold: 20 });
  configure?.(tables);
  await signIn(page, baseURL, as);
  return tables;
}

// The design's batch table shows each stage's next step as the row's one
// button ("Start making", "Send to check", "Count and finish") and puts the
// corrections behind the row's "More for <batch>" menu.
const PRIMARY = ['Start making', 'Send to check', 'Count and finish'];
const MENU = ['Back to planned', 'Back to in production', 'Change details', 'Cancel batch', 'Re-open batch', 'Delete batch'];

async function openMore(page) {
  await page.getByRole('main').getByRole('button', { name: `More for ${BATCH.batch_code}` }).click();
}

const EXPECTED = {
  Queued: {
    [PRODUCTION]: ['Start making', 'Cancel batch'],
    [MANAGER]: ['Start making', 'Change details', 'Cancel batch'],
    [ADMIN]: ['Start making', 'Change details', 'Cancel batch', 'Delete batch'],
  },
  'In Progress': {
    [PRODUCTION]: ['Send to check', 'Back to planned'],
    [MANAGER]: ['Send to check', 'Back to planned', 'Change details', 'Cancel batch'],
    [ADMIN]: ['Send to check', 'Back to planned', 'Change details', 'Cancel batch'],
  },
  'Quality Check': {
    [PRODUCTION]: ['Count and finish', 'Back to in production'],
    [MANAGER]: ['Count and finish', 'Back to in production', 'Change details', 'Cancel batch'],
    [ADMIN]: ['Count and finish', 'Back to in production', 'Change details', 'Cancel batch'],
  },
  Completed: { [PRODUCTION]: [], [MANAGER]: [], [ADMIN]: ['Re-open batch'] },
  Cancelled: { [PRODUCTION]: [], [MANAGER]: [], [ADMIN]: ['Delete batch'] },
};

for (const [status, byRole] of Object.entries(EXPECTED)) {
  for (const [as, offered] of Object.entries(byRole)) {
    test(`a ${status} batch offers ${as.split('@')[0]} exactly: ${offered.join(', ') || 'nothing'}`, async ({ page, baseURL }) => {
      await setup(page, baseURL, as, (tables) => tables.production_batches.push({ ...BATCH, status, good_output_qty: status === 'Completed' ? 95 : 0 }));
      await page.goto(`${baseURL}/production`);
      await page.getByRole('button', { name: /All batches/ }).click();
      await expect(page.getByRole('main').getByText(BATCH.batch_code)).toBeVisible();
      for (const name of PRIMARY) {
        await expect(page.getByRole('main').getByRole('button', { name, exact: true }), name).toHaveCount(offered.includes(name) ? 1 : 0);
      }
      const more = page.getByRole('main').getByRole('button', { name: `More for ${BATCH.batch_code}` });
      if (!offered.some((name) => MENU.includes(name))) {
        await expect(more).toHaveCount(0);
        return;
      }
      await more.click();
      for (const name of MENU) {
        await expect(page.getByRole('menuitem', { name, exact: true }), name).toHaveCount(offered.includes(name) ? 1 : 0);
      }
    });
  }
}

test('an administrator re-opens a finished batch, saying what was wrong', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, ADMIN, (t) => t.production_batches.push({ ...BATCH, status: 'Completed', good_output_qty: 95, damaged_qty: 5 }));
  let command;
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    command = route.request().postDataJSON();
    const batch = tables.production_batches[0];
    Object.assign(batch, { status: 'Quality Check', good_output_qty: 0, damaged_qty: 0 });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(batch) });
  });
  await page.goto(`${baseURL}/production`);
  await page.getByRole('button', { name: /All batches/ }).click();
  await openMore(page);
  await page.getByRole('menuitem', { name: 'Re-open batch', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The 95 good pieces come back off Inventory');
  await dialog.getByRole('button', { name: 'Re-open batch' }).click();
  await expect(dialog.getByText('Write why, so the activity log explains it.').first()).toBeVisible();
  expect(command).toBeUndefined();

  await dialog.getByLabel('What was recorded wrong?').fill('Counted 95 good, there were 90');
  await dialog.getByRole('button', { name: 'Re-open batch' }).click();
  await expect(dialog).toHaveCount(0);
  expect(command.p_action).toBe('reopen_batch');
  expect(command.p_data).toMatchObject({ id: 1001, reason: 'Counted 95 good, there were 90' });
  await expect(page.getByText(`${BATCH.batch_code} is back at quality check.`)).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Count and finish', exact: true })).toBeVisible();
});

test('a manager changes a batch already in production', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, MANAGER, (t) => t.production_batches.push({ ...BATCH, status: 'In Progress' }));
  let command;
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    command = route.request().postDataJSON();
    Object.assign(tables.production_batches[0], { target_output_qty: 120, raw_material_used_qty: 48 });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(tables.production_batches[0]) });
  });
  await page.goto(`${baseURL}/production`);
  await openMore(page);
  await page.getByRole('menuitem', { name: 'Change details', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('How many').fill('120');
  await dialog.getByLabel('Material to set aside').fill('49');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toContainText('Only 48 sheets');
  expect(command).toBeUndefined();
  await dialog.getByLabel('Material to set aside').fill('48');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  expect(command.p_action).toBe('edit_batch');
  expect(command.p_data).toMatchObject({ id: 1001, output_qty: '120', material_qty: '48', assigned_staff_id: 3 });
  await expect(page.getByRole('main').getByRole('row', { name: new RegExp(BATCH.batch_code) })).toContainText('120');
});

test('a batch deleted by an administrator leaves the list', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, ADMIN, (t) => t.production_batches.push({ ...BATCH, status: 'Queued' }));
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    tables.production_batches.splice(0, 1);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: BATCH.id, deleted: true, batch_code: BATCH.batch_code }) });
  });
  await page.goto(`${baseURL}/production`);
  await openMore(page);
  await page.getByRole('menuitem', { name: 'Delete batch', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Why is it being deleted?').fill('Entered twice');
  await dialog.getByRole('button', { name: 'Delete batch' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`${BATCH.batch_code} was deleted.`)).toBeVisible();
  await expect(page.getByRole('main').getByText(BATCH.batch_code)).toHaveCount(0);
});

const orderOnTheWay = (t) => t.raw_material_orders.push({ id: 801, supplier_id: t.suppliers[0].id, raw_material_id: 701, quantity_ordered: 50, unit_price: 100,
  total_cost: 5000, status: 'In Transit', expected_delivery_date: '2026-10-30', quantity_arrived: 0, quantity_lost_transit: 0, claim_status: 'None' });

test('a manager can cancel a supplier order on the way, but not delete it', async ({ page, baseURL }) => {
  await setup(page, baseURL, MANAGER, orderOnTheWay);
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: 'More for order 801' }).click();
  await expect(page.getByRole('menuitem', { name: 'Cancel order', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete order', exact: true })).toHaveCount(0);
});

test('an administrator can delete a supplier order that never arrived', async ({ page, baseURL }) => {
  await setup(page, baseURL, ADMIN, orderOnTheWay);
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: 'More for order 801' }).click();
  await expect(page.getByRole('menuitem', { name: 'Cancel order', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete order', exact: true })).toBeVisible();
});

test('a manager removes a recipe', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, MANAGER, (t) => t.production_recipes.push({ id: 901, product_id: 1, raw_material_id: 701, material_qty: 45, output_qty: 100 }));
  let command;
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    command = route.request().postDataJSON();
    tables.production_recipes.splice(0, 1);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 901, deleted: true }) });
  });
  await page.goto(`${baseURL}/production`);
  // Recipes sit under the make list in the design's Batches screen.
  await page.getByRole('button', { name: 'Make list' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm this step' }).click();
  expect(command).toMatchObject({ p_action: 'delete_recipe', p_data: { id: 901 } });
  await expect(page.getByRole('main')).toContainText('No recipes yet');
});

test('a supplier with finished purchase history is kept on file as no longer used, and can be put back', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, ADMIN, (t) => t.raw_material_orders.push({ id: 801, supplier_id: t.suppliers[0].id, raw_material_id: 701,
    quantity_ordered: 50, unit_price: 100, total_cost: 5000, status: 'Arrived', quantity_arrived: 50, quantity_lost_transit: 0, quantity_usable: 50, claim_status: 'None' }));
  const supplier = tables.suppliers[0];
  await page.goto(`${baseURL}/suppliers/${supplier.id}`);
  await expect(page.getByRole('heading', { name: 'Stop using this supplier' })).toBeVisible();
  await page.getByRole('button', { name: `Remove ${supplier.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Yes, stop using them' }).click();
  await expect(page.getByText(`${supplier.name} is no longer used.`)).toBeVisible();
  expect(supplier.status).toBe('Archived');
  await expect(page.getByRole('button', { name: 'Put them back in use' })).toBeVisible();

  await page.getByRole('button', { name: 'Put them back in use' }).click();
  await expect(page.getByText(`${supplier.name} is in use again.`)).toBeVisible();
  expect(supplier.status).toBe('Active');
});
