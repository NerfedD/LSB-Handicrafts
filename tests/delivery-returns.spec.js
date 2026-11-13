import { test, expect } from '@playwright/test';
import { stubSupabase, signIn } from './stubSupabase.js';

/**
 * A run that goes out and comes back undelivered, and what the paper says it
 * carried. #2042 carries order #1042: 4 bundles of Styro Sheet 1/2 inch, with
 * 64 on the shelf.
 */
test('a run that comes back undelivered puts its goods back on the shelf', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/deliveries/2042`);

  await page.getByRole('button', { name: 'Send out' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Mark on the way' }).click();
  await expect(dialog).toHaveCount(0);
  expect(tables.inventory.find((row) => row.id === 104).stock).toBe(60);

  // What the van carried is on the screen with its count, not a blank.
  const truck = page.getByRole('region', { name: "What's on the truck" });
  await expect(truck.getByText('Styro Sheet 1/2 inch')).toBeVisible();
  await expect(truck.getByText('4', { exact: true })).toBeVisible();

  // Stepping back from "On the way" is the run coming back, not a plain move.
  await expect(page.getByRole('button', { name: 'Move back a step' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Came back undelivered' }).click();
  await expect(page.getByRole('heading', { name: /came back undelivered\?/ })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, it came back' }).click();

  await expect(page.getByText(/is back, and what it carried is on the shelf again/)).toBeVisible();
  expect(tables.inventory.find((row) => row.id === 104).stock).toBe(64);
  const run = tables.deliveries.find((row) => row.id === 2042);
  expect(run).toMatchObject({ status: 'Ready To Go', items_manifest: [] });
  expect(tables.orders.find((row) => row.id === 1042).items[0].committedUnits).toBe(0);
});

test('the printed delivery slip says how many went on the van', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  // #2046 went out with 12 of 20 bundles; the other 8 are #2047's.
  expect(tables.deliveries.find((row) => row.id === 2046).items_manifest[0]).toMatchObject({ deliveredQty: 12 });
  await page.goto(`${baseURL}/deliveries/2046`);
  await expect(page.getByRole('heading', { level: 1, name: 'Delivery #2046' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const slip = page.locator('.slip');
  await expect(slip).toBeVisible();
  await expect(slip.locator('.slip-td-qty').first()).toHaveText('12');
});
