import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';

test('BUG-01: a lost completion response retries the same transaction', async ({ page, baseURL }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/rpc/order_command')) requests.push(request.postDataJSON());
  });
  const tables = await stubSupabase(page, { dropOrderResponseOnce: true });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1042`);
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(page.getByText(/could not reach the database|could not be confirmed/i)).toBeVisible();
  expect(tables.inventory.find((row) => row.id === 104).stock).toBe(60);
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(page.getByText('Order #1042 is done.', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(tables.inventory.find((row) => row.id === 104).stock).toBe(60);
});

test('BUG-02: a stale price correction cannot overwrite another save', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1042`);
  await page.getByRole('button', { name: 'Fix the price', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton').fill('500');
  await dialog.getByRole('radio', { name: /A discount the owner agreed/ }).click();
  const order = tables.orders.find((row) => row.id === 1042);
  Object.assign(order, { revision: 1, total_amount: 550, price_adjustments: [{ newTotal: 550 }] });
  await dialog.getByRole('button', { name: 'Save the new price' }).click();
  await expect(page.getByText(/record changed or is no longer available/)).toBeVisible();
  expect(order.total_amount).toBe(550);
  expect(order.price_adjustments).toHaveLength(1);
});

test('BUG-08: legacy returns ask where the goods went and restore sellable stock', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  const before = tables.inventory.find((row) => row.id === 102).stock;
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1043`);
  await page.getByRole('button', { name: 'Give money back', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton').first().fill('2');
  await expect(dialog.getByRole('radio', { name: /Back on the shelf/ })).toBeVisible();
  await dialog.getByRole('radio', { name: /Back on the shelf/ }).click();
  await dialog.getByRole('radio', { name: /They changed their mind/ }).click();
  await dialog.getByRole('button', { name: /Give back ₱/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(tables.inventory.find((row) => row.id === 102).stock).toBe(before + 2);
  expect(tables.orders.find((row) => row.id === 1043).items[0].committedUnits).toBe(23);
});

test('BUG-11: a follow-up asks for this trip and records only its eight units', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  tables.deliveries.find((row) => row.id === 2047).status = 'Ready To Go';
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/deliveries/2047`);
  await page.getByRole('button', { name: /It is on the way/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('spinbutton').first()).toHaveValue('8');
  await dialog.getByRole('button', { name: /Yes, it is on the way/ }).click();
  await expect(dialog).toHaveCount(0);
  const manifest = tables.deliveries.find((row) => row.id === 2047).items_manifest;
  expect(manifest[0]).toMatchObject({ deliveredQty: 8, backorderQty: 0 });
  expect(tables.inventory.find((row) => row.id === 104).stock).toBe(56);
  expect(tables.orders.find((row) => row.id === 1046).items[0].committedUnits).toBe(20);
});

test('BUG-12: the dashboard add action clears an earlier product selection', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/1`);
  await page.getByRole('button', { name: /^Dashboard/ }).click();
  await page.getByRole('button', { name: 'Add a product', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Add a product' })).toBeVisible();
});

test('BUG-13/15: refreshing an edit retains the order and its renamed customer identity', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  tables.customers.find((row) => row.id === 202).name = 'Liza Updated';
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1042/edit`);
  await page.reload();
  await expect(page.getByRole('combobox', { name: /^Customer/ })).toHaveValue('Liza Villanueva');
  await page.getByRole('button', { name: 'Save the changes' }).click();
  await expect(page).toHaveURL(/\/orders\/1042$/);
  expect(tables.orders.find((row) => row.id === 1042).customer_id).toBe(202);
});

test('BUG-14: a formatted staff phone reaches account creation as digits', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff`);
  await page.getByRole('button', { name: 'Add a staff account', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Their name').fill('Phone test');
  await dialog.getByRole('radio', { name: /Sales Staff/ }).click();
  await dialog.getByLabel('Email address').fill('phone@example.test');
  await dialog.getByLabel('Phone number').fill('0917 555 0201');
  await dialog.getByLabel('First password').fill('ValidPass123');
  const sent = page.waitForRequest('**/functions/v1/admin-accounts');
  await dialog.getByRole('button', { name: 'Create the account' }).click();
  expect((await sent).postDataJSON().contactNumber).toBe('09175550201');
});

test('BUG-01: a second retry after a twice-failed delivery still saves the order', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);

  // The order row survives each attempt and its revision climbs with it. A
  // retry that kept sending 0 was refused by its own staleness check from the
  // second attempt on, stranding a correctly filled form.
  let failDelivery = 2;
  await page.route('**/rest/v1/deliveries**', async (route) => {
    if (route.request().method() === 'POST' && failDelivery > 0) {
      failDelivery--;
      return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ code: '53300', message: 'too many connections' }) });
    }
    await route.fallback();
  });

  await page.goto(`${baseURL}/orders/new`);
  const form = page.getByRole('main');
  await form.getByLabel(/^Customer/).fill('Retry Regression');
  await form.getByLabel('Item').click();
  await page.getByRole('option', { name: /Styro Ball 4 inch/ }).click();
  await form.getByLabel('How many').fill('3');
  await form.getByLabel('Where to').fill('12 Retry Street');

  await page.getByRole('button', { name: 'Write this order' }).click();
  await expect(page.getByText(/the delivery was not/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Write this order' }).click();
  await expect(page.getByText(/the delivery was not/i).first()).toBeVisible();
  // The staleness message belongs to somebody else's edit, not to a retry of
  // this form's own write.
  await expect(page.getByText(/record changed or is no longer available/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Write this order' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'One order' })).toBeVisible();

  const written = tables.orders.filter((row) => row.customer_name === 'Retry Regression');
  expect(written).toHaveLength(1);
  expect(tables.deliveries.filter((row) => row.product === `Order #${written[0].id} - Retry Regression`)).toHaveLength(1);
});
