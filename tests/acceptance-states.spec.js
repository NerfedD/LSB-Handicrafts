import { expect, test } from '@playwright/test';
import { signIn, stubSupabase } from './stubSupabase.js';

for (const [path, title] of [['products', 'No products yet'], ['orders', 'No orders yet'], ['customers', 'No customers yet'], ['suppliers', 'No suppliers yet']]) {
  test(`UI-02: ${path} has an explicit empty state`, async ({ page, baseURL }) => {
    const tables = await stubSupabase(page);
    for (const name of ['products', 'inventory', 'orders', 'deliveries', 'customers', 'suppliers']) tables[name].splice(0);
    await signIn(page, baseURL); await page.goto(`${baseURL}/${path}`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('We could not reach the system', { exact: true })).toHaveCount(0);
  });
}

test('UI-02: product search distinguishes no matches and clears back to the populated list', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/products`);
  await page.getByPlaceholder('Search by name or code').fill('QA-NO-MATCH-' + (process.env.QA_RUN_ID || 'local'));
  await expect(page.getByRole('heading', { name: 'Nothing matched that', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No products yet', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear the search box' }).filter({ hasText: 'Clear the search box' }).click();
  await expect(page.getByRole('row', { name: /Styro Ball 4 inch/ })).toBeVisible();
});

test('UI-03: missing record URLs never display a previously opened record', async ({ page, baseURL }, info) => {
  const failures = [];
  page.on('requestfailed', (request) => failures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/1`);
  await expect(page.getByRole('main')).toContainText('Styro Ball 4 inch');
  for (const [path, noun] of [['products', 'product'], ['orders', 'order'], ['deliveries', 'delivery'], ['customers', 'customer'], ['suppliers', 'supplier'], ['staff', 'account']]) {
    await page.goto(`${baseURL}/${path}/99999999`);
    await expect(page.getByRole('heading', { name: `That ${noun} is not here any more`, exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Styro Ball 4 inch', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: `That ${noun} is not here any more`, exact: true })).toBeVisible();
  }
  await info.attach('navigation-request-failures', { body: JSON.stringify(failures), contentType: 'application/json' });
});

test('UI-05: slow customer read, failed read and retry are different from an empty list', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  let release;
  let fail = true;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/rest/v1/customers**', async (route) => {
    if (route.request().method() === 'GET' && fail) {
      await held;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA read failure' }) });
    }
    await route.fallback();
  });
  await page.goto(`${baseURL}/customers`);
  await expect(page.getByText('Fetching your customers…', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No customers yet' })).toHaveCount(0);
  release();
  await expect(page.getByRole('heading', { name: 'We could not reach the system', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('main').getByText('Reyes Events', { exact: true })).toBeVisible();
});
