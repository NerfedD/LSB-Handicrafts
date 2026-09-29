import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';

/**
 * The purchasing, production and stock workflows as a reviewer walks them:
 * finding each screen, the controlled lists, product photos, and the checks
 * that refuse a past date, a bad code or a used-up material beside the field.
 */

// A 1 × 1 PNG, so the photo field has a real image to resize.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const localDay = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function setup(page, baseURL, { as, configure } = {}) {
  const tables = await stubSupabase(page, as ? { as } : {});
  tables.raw_materials.push(
    { id: 701, sku: 'RAW-2', name: 'Styro Sheet 2 inch', material_type: 'sheet', unit: 'sheet', stock: 48, low_stock_threshold: 20, status: 'Active', revision: 0 },
    { id: 702, sku: 'RAW-3', name: 'Styro Sheet 3 inch', material_type: 'sheet', unit: 'sheet', stock: 0, low_stock_threshold: 5, status: 'Active', revision: 0 },
    { id: 703, sku: 'OLD-GLUE', name: 'Old glue', material_type: 'adhesive', unit: 'bottle', stock: 0, low_stock_threshold: 1, status: 'Archived', revision: 1 },
  );
  configure?.(tables);
  await signIn(page, baseURL, as);
  return tables;
}

/** Answers workshop_command the way the database would for the calls these tests make. */
async function stubWorkshop(page, tables, calls) {
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const { p_action: action, p_data: data } = body;
    let row;
    if (action === 'save_material') {
      row = { id: 710 + calls.length, stock: 0, status: 'Active', revision: 0, ...data, sku: data.sku || 'RM-SHT-001' };
      tables.raw_materials.push(row);
    } else if (action === 'save_order') {
      row = { id: 880 + calls.length, status: data.expected_delivery_date ? 'Delivery Scheduled' : 'Ordered', quantity_arrived: 0,
        quantity_lost_transit: 0, claim_status: 'None', total_cost: Number(data.quantity_ordered) * Number(data.unit_price), ...data,
        supplier_id: Number(data.supplier_id), raw_material_id: Number(data.raw_material_id), quantity_ordered: Number(data.quantity_ordered) };
      tables.raw_material_orders.push(row);
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(row) });
  });
}

test.describe('finding the work', () => {
  test('purchasing, raw materials, production and products are four separate destinations', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    const sidebar = page.locator('aside');
    for (const label of ['Purchasing', 'Raw materials', 'Production', 'Products & stock']) {
      await expect(sidebar.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await expect(sidebar.getByText('Stock & production')).toBeVisible();

    await sidebar.getByRole('button', { name: /^Production/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Production' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Production sections' }).getByRole('button', { name: 'Production report' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'How stock moves here' })).toContainText('The material used is deducted');

    await sidebar.getByRole('button', { name: /^Purchasing/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Purchasing' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Order materials' })).toBeVisible();
    // The workshop tab strip that used to hide these screens is gone.
    await expect(page.getByRole('navigation', { name: 'Workshop sections' })).toHaveCount(0);
  });

  test('primary actions sit in the page, next to the filters', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/products`);
    await expect(page.getByRole('main').getByRole('button', { name: 'Add a product' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Add a product' })).toHaveCount(0);
    await page.goto(`${baseURL}/orders`);
    await page.getByRole('main').getByRole('button', { name: 'Create order' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create an order' })).toBeVisible();
  });

  test('help explains the screen it is opened on', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/raw-material-orders`);
    await page.getByRole('banner').getByRole('button', { name: 'Help' }).click();
    await expect(page.getByText(/Only the usable units counted at receiving are added to stock/)).toBeVisible();
  });
});

test.describe('categories and photos', () => {
  test('a new category that matches an existing one is pointed back to the list', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/products/new`);
    await page.getByRole('radio', { name: 'Styro ball' }).click();
    await page.getByLabel('Product name').fill('Styro Ball 9 inch');
    await page.getByLabel('How wide across').fill('9');
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Add a new category…' }).click();
    await page.getByLabel('New category name').fill('  styro   BALLS ');
    await page.getByLabel('Price').fill('300');
    await page.getByRole('button', { name: 'Save this product' }).click();
    // Said beside the field it is about, not only in a box at the top.
    await expect(page.getByLabel('New category name')).toHaveAccessibleDescription('There is already a category called "Styro Balls". Choose it from the list instead.');
    // What was typed is still there.
    await expect(page.getByLabel('Product name')).toHaveValue('Styro Ball 9 inch');
  });

  test('a product saves with a new category and a photo, which survive a reload, and the photo can be replaced and removed', async ({ page, baseURL }) => {
    const tables = await setup(page, baseURL);
    const rpcs = [];
    page.on('request', (request) => {
      if (/rpc\/(category_command|save_product_image)/.test(request.url())) rpcs.push(request.url().split('/rpc/')[1]);
    });
    await page.goto(`${baseURL}/products/new`);
    await page.getByRole('radio', { name: 'Styro ball' }).click();
    await page.getByLabel('Product name').fill('Styro Ball 9 inch');
    await page.getByLabel('How wide across').fill('9');
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Add a new category…' }).click();
    await page.getByLabel('New category name').fill('Large Balls');
    // A whole number is a price; nobody has to type ".00".
    await page.getByLabel('Price').fill('300');
    await page.getByLabel('Product photo').setInputFiles({ name: 'ball.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: 'Photo of Styro Ball 9 inch' })).toBeVisible();
    await page.getByRole('button', { name: 'Save this product' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Product details' })).toBeVisible();
    expect(rpcs).toEqual(['category_command', 'save_product_image']);
    expect(tables.product_categories.map((c) => c.name)).toContain('Large Balls');
    const product = tables.products.find((p) => p.name === 'Styro Ball 9 inch');
    expect(Number(product.unit_price)).toBe(300);
    expect(tables.inventory.find((i) => i.sku === product.item_code)?.category ?? 'Large Balls').toBe('Large Balls');
    expect(tables.product_images).toEqual([expect.objectContaining({ product_id: product.id, data_url: expect.stringMatching(/^data:image\/jpeg;base64,/) })]);

    await page.reload();
    await expect(page.getByRole('img', { name: 'Photo of Styro Ball 9 inch' })).toBeVisible();

    await page.getByRole('button', { name: /^Edit/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit product' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByText('The photo will be removed when you save the product.')).toBeVisible();
    await page.getByRole('button', { name: 'Keep the saved photo' }).click();
    await page.getByLabel('Product photo').setInputFiles({ name: 'ball2.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Product details' })).toBeVisible();
    expect(tables.product_images).toHaveLength(1);

    await page.getByRole('button', { name: /^Edit/ }).first().click();
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await page.getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Product details' })).toBeVisible();
    expect(tables.product_images).toHaveLength(0);
    await expect(page.getByText('No photo yet')).toBeVisible();
  });

  test('categories are managed in one list, and one in use cannot be removed', async ({ page, baseURL }) => {
    const tables = await setup(page, baseURL);
    await page.goto(`${baseURL}/products`);
    await page.getByRole('main').getByRole('button', { name: 'Categories' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Styro Balls' })).toContainText('2 products');
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Styro Balls' }).getByRole('button', { name: 'Remove' })).toBeDisabled();
    await dialog.getByLabel('New category').fill('styro balls');
    await dialog.getByRole('button', { name: 'Add category' }).click();
    await expect(dialog).toContainText('There is already a category called "Styro Balls".');
    await dialog.getByLabel('New category').fill('Wall Art');
    await dialog.getByRole('button', { name: 'Add category' }).click();
    await expect(dialog).toContainText('"Wall Art" was added.');
    await dialog.getByRole('listitem').filter({ hasText: 'Wall Art' }).getByRole('button', { name: 'Remove' }).click();
    await expect(dialog).toContainText('"Wall Art" was removed.');
    expect(tables.product_categories.map((c) => c.name)).not.toContain('Wall Art');
  });

  test('the product form explains a negative size beside the field and keeps what was typed', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/products/new`);
    await page.getByRole('radio', { name: 'Styro ball' }).click();
    await page.getByLabel('Product name').fill('Tiny ball');
    await page.getByLabel('How wide across').fill('-2');
    await page.getByLabel('Price').fill('12.345');
    await page.getByRole('button', { name: 'Save this product' }).click();
    await expect(page.getByLabel('How wide across')).toHaveAccessibleDescription('The width across must be a number above 0.');
    await expect(page.getByLabel('Price')).toHaveAccessibleDescription('The price can have at most 2 decimal places.');
    await expect(page.getByLabel('Product name')).toHaveValue('Tiny ball');
  });
});

test.describe('raw materials and purchasing', () => {
  test('units come from a managed list, a new unit and a typed code are checked beside their fields', async ({ page, baseURL }) => {
    const tables = await setup(page, baseURL);
    const calls = [];
    await stubWorkshop(page, tables, calls);
    await page.goto(`${baseURL}/raw-materials`);
    await page.getByRole('button', { name: 'Add raw material' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Material name').fill('Hot glue, 1/2" (clear)');
    await dialog.getByLabel('Material code').fill('GLUE_1');
    await dialog.getByLabel('Kind of material').selectOption('adhesive');
    await dialog.getByLabel('Unit it is counted in').selectOption('__other');
    await dialog.getByLabel('Name of the new unit').fill('stick!');
    await dialog.getByLabel('Density (kg/m³)').fill('-3');
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByLabel('Material code')).toHaveAccessibleDescription('Use 2 to 40 letters, numbers and single hyphens, such as SS-100-4X8.');
    await expect(dialog.getByLabel('Name of the new unit')).toHaveAccessibleDescription('Write the unit in letters only, such as sheet, roll or kg.');
    await expect(dialog.getByLabel('Density (kg/m³)')).toHaveAccessibleDescription('The density must be a number above 0.');
    await expect(dialog.getByRole('alert')).toHaveText('Check the 3 fields marked below.');
    expect(calls).toHaveLength(0);

    await dialog.getByLabel('Material code').fill('');
    await dialog.getByLabel('Name of the new unit').fill('Stick');
    await dialog.getByLabel('Density (kg/m³)').fill('30');
    await dialog.getByLabel('Weight of one unit (kg)').fill('1');
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls[0].p_data).toMatchObject({ name: 'Hot glue, 1/2" (clear)', sku: '', unit: 'stick', density: '30', weight_kg: '1', material_type: 'adhesive' });
    await expect(page.getByText(/was added as RM-SHT-001/)).toBeVisible();
  });

  test('archived and out-of-stock materials stay findable', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/raw-materials`);
    await expect(page.getByRole('main')).not.toContainText('Old glue');
    await page.getByRole('radio', { name: /Out of stock/ }).click();
    await expect(page.getByRole('main')).toContainText('Styro Sheet 3 inch');
    await expect(page.getByRole('main').getByText('Out of stock', { exact: true }).last()).toBeVisible();
    await page.getByRole('radio', { name: /No longer in use/ }).click();
    await expect(page.getByRole('main')).toContainText('Old glue');
  });

  test('ordering more from a material is one step, refuses a past date, and says where the order went', async ({ page, baseURL }) => {
    const tables = await setup(page, baseURL);
    const calls = [];
    await stubWorkshop(page, tables, calls);
    await page.goto(`${baseURL}/raw-materials`);
    await page.getByRole('group', { name: 'Styro Sheet 3 inch' }).getByRole('button', { name: 'Order more' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Material to order')).toHaveValue('702');
    await dialog.getByLabel('Supplier').selectOption({ index: 1 });
    await dialog.getByLabel('How many sheets').fill('40');
    await dialog.getByLabel('Agreed price per unit (₱)').fill('95');
    await dialog.getByLabel('Promised delivery date').fill(localDay(-1));
    await dialog.getByRole('button', { name: 'Place order' }).click();
    await expect(dialog.getByLabel('Promised delivery date')).toHaveAccessibleDescription('That date has already passed. Choose today or a later date.');
    expect(calls).toHaveLength(0);

    await dialog.getByLabel('Promised delivery date').fill(localDay(3));
    await dialog.getByRole('button', { name: 'Place order' }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls[0]).toMatchObject({ p_action: 'save_order', p_data: expect.objectContaining({ raw_material_id: 702, quantity_ordered: '40', unit_price: '95' }) });
    await expect(page.getByText(/Order #\d+ was saved/)).toBeVisible();
    await page.getByRole('button', { name: 'Open Purchasing' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Purchasing' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Styro Sheet 3 inch');
  });
});

test.describe('production', () => {
  test('a used-up material cannot be chosen for a batch, and an archived one is not offered', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/production`);
    await page.getByRole('main').getByRole('button', { name: 'Start batch', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    const picker = dialog.getByLabel('Which raw material?');
    await expect(picker.locator('option', { hasText: 'Styro Sheet 3 inch' })).toBeDisabled();
    await expect(picker.locator('option', { hasText: 'Styro Sheet 3 inch' })).toContainText('none free (out of stock)');
    await expect(picker.locator('option', { hasText: 'Styro Sheet 2 inch' })).toBeEnabled();
    await expect(picker.locator('option', { hasText: 'Old glue' })).toHaveCount(0);
  });

  test('setting aside more than is free is explained beside the field', async ({ page, baseURL }) => {
    await setup(page, baseURL);
    await page.goto(`${baseURL}/production`);
    await page.getByRole('main').getByRole('button', { name: 'Start batch', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('What are we making?').selectOption('1');
    await dialog.getByLabel('Target pieces').fill('10');
    await dialog.getByLabel('Which raw material?').selectOption('701');
    await dialog.getByLabel('Material to set aside').fill('60');
    await dialog.getByRole('button', { name: 'Plan this batch' }).click();
    await expect(dialog.getByLabel('Material to set aside')).toHaveAccessibleDescription('Only 48 sheets of Styro Sheet 2 inch are free after other batches. Set aside 48 or fewer.');
  });
});

test.describe('orders and stock history', () => {
  test('a customer delivery cannot be promised for a day that has passed', async ({ page, baseURL }) => {
    const writes = [];
    const tables = await stubSupabase(page, { onWrite: (w) => writes.push(w) });
    void tables;
    await signIn(page, baseURL);
    await page.goto(`${baseURL}/orders/new`);
    await page.getByPlaceholder('Ana Reyes').fill('Walk-in buyer');
    await page.getByLabel('Item').click();
    await page.getByRole('option', { name: /Styro Ball 4 inch/ }).click();
    await page.getByLabel('How many').fill('2');
    await page.getByLabel('Where to').fill('12 Mabini St, Davao City');
    await page.getByLabel('Promised for').fill(localDay(-2));
    await page.getByRole('main').getByRole('button', { name: 'Create order', exact: true }).last().click();
    await expect(page.getByLabel('Promised for')).toHaveAccessibleDescription('That date has already passed. Choose today or a later date.');
    expect(writes.filter((w) => w.table === 'orders')).toHaveLength(0);
  });

  test('stock history reads as stock in, stock out and balance', async ({ page, baseURL }) => {
    const tables = await setup(page, baseURL);
    tables.stock_movements.push(
      { id: 9001, inventory_id: 101, raw_material_id: null, item_code: 'SB-040', item_name: 'Styro Ball 4 inch', quantity_change: 20, balance_after: 160, kind: 'production', actor_name: 'Ana Reyes', created_at: new Date().toISOString() },
      { id: 9002, inventory_id: 101, raw_material_id: null, item_code: 'SB-040', item_name: 'Styro Ball 4 inch', quantity_change: -20, balance_after: 140, kind: 'sale', order_id: 1043, actor_name: 'Maria Santos', created_at: new Date().toISOString() },
    );
    await page.goto(`${baseURL}/products/1`);
    const history = page.getByRole('table', { name: /Every change to this stock count/ });
    for (const header of ['Stock in', 'Stock out', 'Balance']) {
      await expect(history.getByRole('columnheader', { name: header })).toBeVisible();
    }
    await expect(history.getByRole('row', { name: /Made in production/ })).toContainText('+20');
    await expect(history.getByRole('row', { name: /Sold/ })).toContainText('−20');
  });
});

test('a supplier order not yet sent can have its quantity and price corrected', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL, { configure: (t) => {
    t.raw_material_orders.push({ id: 802, supplier_id: t.suppliers[0].id, raw_material_id: 701, quantity_ordered: 50, unit_price: 100, total_cost: 5000, status: 'Ordered', quantity_arrived: 0, quantity_lost_transit: 0, claim_status: 'None' });
  } });
  const calls = [];
  await page.route('**/rest/v1/rpc/workshop_command', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const order = tables.raw_material_orders.find((o) => o.id === 802);
    Object.assign(order, { quantity_ordered: Number(body.p_data.quantity_ordered), unit_price: Number(body.p_data.unit_price) });
    order.total_cost = order.quantity_ordered * order.unit_price;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(order) });
  });
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: 'Edit order' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('To change the supplier or material, cancel this order and place a new one.');
  await dialog.getByLabel('How many sheets').fill('60');
  await dialog.getByLabel('Agreed price per unit (₱)').fill('95');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls[0].p_data).toEqual({ id: 802, quantity_ordered: '60', unit_price: '95', expected_delivery_date: '', carrier_notes: '' });
  await expect(page.getByText('Supplier order #802 was updated.')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('60 sheets');
});
