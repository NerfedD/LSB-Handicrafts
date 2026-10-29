import { expect, test } from '@playwright/test';
import { signIn, stubSupabase } from './stubSupabase.js';

// Regression tests for the bugs found in the adversarial QA run
// QA-BUG-20261018-01 (docs/testing-reports/QA-BUG-20261018-01-bughunt.md).

test('BUG-F01: the price fix refuses a negative price beside the field and leaves the total alone', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1041`);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #1041' })).toBeVisible();

  await page.getByRole('button', { name: 'Fix the price' }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('What it should be', { exact: false }).first();
  await field.fill('-10');
  await dialog.getByRole('radio', { name: /The rate was typed wrong/i }).click();

  await expect(dialog.getByText(/must be an amount of 0 or more/i)).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(tables.orders.find((row) => row.id === 1041).total_amount).toBe(6280);

  // Three decimal places are refused too, not rounded into a different price.
  await field.fill('10.999');
  await expect(dialog.getByText(/at most 2 decimal places/i)).toBeVisible();
});

test('BUG-F03: Production Staff do not see the customer\'s address or phone on an order', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page, { as: 'ana@lsbhandicrafts.test' });
  tables.staff.find((row) => row.email === 'ana@lsbhandicrafts.test').status = 'Active';

  await signIn(page, baseURL, 'ana@lsbhandicrafts.test');
  await page.goto(`${baseURL}/orders/1041`);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #1041' })).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('12 Mabini St, Poblacion');
  expect(bodyText).not.toContain('written against a name rather than a saved customer');
  expect(bodyText).toContain('kept to the office');
});

test('BUG-F04: an Admin cannot block, remove or change the role of their own account, whatever the email capitalisation', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  const adminRow = tables.staff.find((row) => row.id === 1);
  adminRow.email = 'Maria.Santos@lsbhandicrafts.test';
  adminRow.is_super_admin = false;

  await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff/1`);
  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible();

  expect(await page.getByRole('button', { name: /Stop Maria signing in/i }).count()).toBe(0);
  expect(await page.getByRole('button', { name: /Remove Maria/i }).count()).toBe(0);
  expect(await page.getByRole('button', { name: /Change this/i }).count()).toBe(0);
});

test('BUG-F05: a blank reorder point is saved as 50, not 0', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/new`);

  await page.getByLabel(/^Name /).fill('Regression Ball 8 inch');
  await page.getByLabel('How wide across').fill('8');
  await page.getByLabel('Price').fill('250');
  await page.getByLabel('On the shelf').fill('20');
  await page.getByRole('button', { name: 'Add product' }).click();

  await expect(page.getByText(/Regression Ball 8 inch/).first()).toBeVisible();
  const createdInventory = tables.inventory.find((row) => row.name === 'Regression Ball 8 inch');
  expect(createdInventory.low_stock_threshold).toBe(50);
});

test('BUG-F07: the replacement dialog marks the bad field and starts clean when reopened', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1043`);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #1043' })).toBeVisible();

  await page.getByRole('button', { name: 'Replace goods' }).click();
  let dialog = page.getByRole('dialog');
  const qtyInput = dialog.getByLabel(/How many .* came back/i);
  await qtyInput.fill('99');
  await dialog.getByLabel('Note').fill('a stale note');
  await dialog.getByRole('button', { name: 'Record the replacement' }).click();

  await expect(qtyInput).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText(/Only \d+ of .* reached the customer/)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Replace goods' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/How many .* came back/i)).toHaveValue('');
  await expect(dialog.getByLabel('Note')).toHaveValue('');
  await expect(dialog.getByText(/reached the customer/)).toHaveCount(0);
});

test('BUG-F08: recording a delivery refuses more units than were ordered instead of quietly clamping', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/deliveries/2042`);

  await page.getByRole('button', { name: 'Send out' }).click();
  const dialog = page.getByRole('dialog');
  // The per-line counts appear once somebody says not everything went.
  await dialog.getByRole('radio', { name: 'Some were left behind' }).click();
  const count = dialog.getByLabel('Styro Sheet 1/2 inch');
  await count.fill('999');
  await expect(dialog.getByText(/must be 4 or less/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Mark on the way' }).click();

  expect(tables.deliveries.find((row) => row.id === 2042).status).toBe('Ready To Go');

  await count.fill('');
  await expect(dialog.getByText(/is needed/i)).toBeVisible();
  await count.fill('1.5');
  await expect(dialog.getByText(/whole number/i)).toBeVisible();
});

test('BUG-F12: the text the QA run named on the order screen is the design 13px or more', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1041`);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #1041' })).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));

  // The subtotal labels and the line under the title that says when it was
  // taken. The admin dashboard design sets meta text at 13px (it was 16px
  // under the previous overhaul).
  const sizes = await page.evaluate(() => {
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const labels = [...document.querySelectorAll('main dt')]
      .filter((el) => /^(Items|Delivery|Order total|Given back)$/.test(el.textContent.trim()))
      .map((el) => ({ text: el.textContent.trim(), fontSize: px(el) }));
    const taken = [...document.querySelectorAll('main p')]
      .filter((el) => /taken /.test(el.textContent.trim()))
      .map((el) => ({ text: el.textContent.trim(), fontSize: px(el) }));
    return [...labels, ...taken];
  });
  expect(sizes.length).toBeGreaterThan(1);
  expect(sizes.filter((one) => one.fontSize < 13), JSON.stringify(sizes)).toEqual([]);
});
