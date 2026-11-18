import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';
import { localDateIso } from '../src/utils/dates.js';
import { formatPeso } from '../src/utils/profileFormat.js';

async function setup(page, baseURL, options) {
  const tables = await stubSupabase(page, options);
  tables.raw_materials.push({ id: 701, sku: 'RM-701', name: 'Foam sheet', unit: 'sheet', stock: 0, status: 'Active' });
  tables.raw_material_orders.push({ id: 801, supplier_id: tables.suppliers[0].id, raw_material_id: 701, quantity_ordered: 30,
    unit_price: 100, total_cost: 3000, status: 'Arrived', order_date: localDateIso(), payment_method: 'cod', paid_at: null, claim_status: 'None' });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole('button', { name: /All orders/ }).click();
  return tables;
}
async function startPayment(page) {
  await page.getByRole('button', { name: 'Payments for order 801' }).click();
  await page.getByRole('button', { name: 'Record supplier payment', exact: true }).click();
  return page.getByRole('dialog', { name: 'Record supplier payment', exact: true });
}
const cashCard = (page, label) => page.getByRole('region', { name: 'Cash flow totals' }).locator('div.rounded-lg').filter({ has: page.getByText(label, { exact: true }) });

test('a partial supplier payment, refund and reload preserve the balance and cash flow', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  await expect(page.getByRole('table', { name: 'Supplier orders' })).toContainText('₱0.00 paid · ₱3,000.00 owed');
  const dialog = await startPayment(page);
  await dialog.getByLabel(/^Amount paid/).fill('1000');
  await dialog.getByRole('button', { name: 'Record supplier payment', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('table', { name: 'Supplier orders' })).toContainText('₱1,000.00 paid · ₱2,000.00 owed');
  await expect(cashCard(page, 'Supplier cash payments')).toContainText('₱1,000.00');
  await expect(cashCard(page, 'Net recorded cash movement')).toContainText(formatPeso(-1000));
  await page.getByRole('button', { name: 'Payments for order 801' }).click();
  await page.getByRole('button', { name: 'Record supplier refund', exact: true }).click();
  const refund = page.getByRole('dialog', { name: 'Record supplier refund', exact: true });
  await refund.getByLabel(/^Amount refunded/).fill('200');
  await refund.getByLabel(/^Reason for refund/).fill('Two damaged sheets returned');
  await refund.getByRole('button', { name: 'Record supplier refund', exact: true }).click();
  await expect(refund).toBeHidden();
  await expect(cashCard(page, 'Supplier cash refunds')).toContainText('₱200.00');
  await expect(cashCard(page, 'Net recorded cash movement')).toContainText(formatPeso(-800));
  await page.reload();
  await page.getByRole('button', { name: /All orders/ }).click();
  await page.getByRole('button', { name: 'Payments for order 801' }).click();
  const history = page.getByRole('dialog', { name: 'Payments for supplier order #801' });
  await expect(history).toContainText('Two damaged sheets returned');
  await expect(history).toContainText('₱2,000.00');
  expect(tables.supplier_payments).toHaveLength(2);
  expect(tables.raw_materials[0].stock).toBe(0);
});

test('a card charge affects cash only when a card-bill payment is recorded', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  const dialog = await startPayment(page);
  await dialog.getByLabel(/^Payment method/).selectOption('card');
  await dialog.getByLabel(/^Reference number/).fill('CARD-888');
  await dialog.getByRole('button', { name: 'Record supplier payment', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(cashCard(page, 'Supplier cash payments')).toContainText('₱0.00');
  await expect(page.getByRole('region', { name: 'Recorded cash flow' })).toContainText('₱3,000.00');
  await page.getByRole('button', { name: 'Record card-bill payment', exact: true }).click();
  const bill = page.getByRole('dialog', { name: 'Record card-bill payment', exact: true });
  await bill.getByLabel(/^Amount paid/).fill('600');
  await bill.getByLabel(/^Reference number/).fill('BANK-888');
  await bill.getByRole('button', { name: 'Record card-bill payment', exact: true }).click();
  await expect(bill).toBeHidden();
  await expect(cashCard(page, 'Card-bill payments')).toContainText('₱600.00');
  await expect(cashCard(page, 'Net recorded cash movement')).toContainText(formatPeso(-600));
  await expect(page.getByRole('region', { name: 'Recorded cash flow' })).toContainText('₱2,400.00');
});

test('a rejected save leaves the payment form open and does not change the balance', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  await page.route('**/rest/v1/rpc/record_supplier_payment', (route) => route.fulfill({ status: 400, contentType: 'application/json',
    body: JSON.stringify({ code: 'P0001', message: 'That is more than is owed. Refresh and retry.' }) }));
  const dialog = await startPayment(page);
  await dialog.getByLabel(/^Amount paid/).fill('1000');
  await dialog.getByRole('button', { name: 'Record supplier payment', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('That is more than is owed. Refresh and retry.');
  expect(tables.supplier_payments).toHaveLength(0);
});

test('cash flow load errors offer retry and do not show zero as a successful result', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.route('**/rest/v1/rpc/cash_flow_summary', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Cash flow temporarily unavailable.' }) }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry cash flow' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cash flow totals' })).toHaveCount(0);
});

test('payment controls fit a phone and keep totals inside the page', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, baseURL);
  const dialog = await startPayment(page);
  await expect(dialog.getByLabel(/^Amount paid/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.evaluate(async (el) => { await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))); });
  await page.screenshot({ path: 'qa-artifacts/supplier-payment-mobile.png' });
});

test('sales can receive orders but cannot see or fetch the supplier ledger', async ({ page, baseURL }) => {
  const financialReads = [];
  page.on('request', (request) => { if (/supplier_payments|cash_flow_summary/.test(request.url())) financialReads.push(request.url()); });
  await setup(page, baseURL, { as: 'juan@lsbhandicrafts.test' });
  await expect(page.getByRole('button', { name: 'Payments for order 801' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Recorded cash flow' })).toHaveCount(0);
  expect(financialReads).toEqual([]);
});

test('older automatic paid markers require receipt reconciliation', async ({ page, baseURL }) => {
  const tables = await setup(page, baseURL);
  tables.raw_material_orders[0].paid_at = new Date().toISOString();
  await page.reload();
  await page.getByRole('button', { name: /All orders/ }).click();
  await page.getByRole('button', { name: 'Payments for order 801' }).click();
  const history = page.getByRole('dialog', { name: 'Payments for supplier order #801' });
  await expect(history).toContainText('An older automatic paid marker exists');
  await expect(history).toContainText('No confirmed payments have been recorded');
});
