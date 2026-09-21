import { expect, test } from '@playwright/test';
import { signIn, stubSupabase } from './stubSupabase.js';
import { SIGNED_IN_EMAIL } from './fixtures.js';

test('refresh keeps a nested record and its exact query', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/products/1/edit?source=audit`);
  await expect(page.getByLabel('Product name')).toHaveValue('Styro Ball 4 inch');
  await page.reload();
  await expect(page).toHaveURL(/\/products\/1\/edit\?source=audit$/);
  await expect(page.getByLabel('Product name')).toHaveValue('Styro Ball 4 inch');
});

test('filtered orders retain the query through refresh and browser history', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders?tab=waiting&query=Maria&source=audit`);
  await expect(page.getByPlaceholder('Search by customer or order number')).toHaveValue('Maria');
  await page.reload();
  await expect(page).toHaveURL(/tab=waiting&query=Maria&source=audit/);
  await page.getByRole('navigation').getByRole('button', { name: /^Products & stock/ }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.goBack();
  await expect(page.getByPlaceholder('Search by customer or order number')).toHaveValue('Maria');
});

test('a clean login from a nested URL lands on the overview', async ({ page, baseURL }) => {
  await stubSupabase(page);
  await page.goto(`${baseURL}/products/new?tab=low`);
  await page.getByLabel('Username or email').fill(SIGNED_IN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/dashboard`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

for (const response of ['staff', 'auth']) {
  test(`blocked login displays the dedicated banner (${response})`, async ({ page, baseURL }) => {
    await stubSupabase(page, { as: 'ana@lsbhandicrafts.test' });
    if (response === 'auth') await page.route('**/auth/v1/token**', (route) => route.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'user_banned', message: 'User is banned' }),
    }));
    await page.goto(baseURL);
    await page.getByLabel('Username or email').fill('ana@lsbhandicrafts.test');
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('An administrator has blocked this account.')).toBeVisible();
    await expect(page.getByText('That username or password did not match.')).toHaveCount(0);
  });
}

// A second device must not be able to sign the first one out by failing to
// read the staff table. Supabase defaults signOut() to scope=global, which
// revokes every refresh token the account holds; only a verdict ON THE ACCOUNT
// earns that. The scope travels as a query parameter on /logout.
for (const { label, status, banner, scope } of [
  { label: 'a failed staff read signs out only this device', status: 'offline',
    banner: 'We could not reach the system.', scope: 'local' },
  { label: 'a blocked account still loses every session', status: 'blocked',
    banner: 'An administrator has blocked this account.', scope: 'global' },
]) {
  test(label, async ({ page, baseURL }) => {
    const logouts = [];
    await stubSupabase(page, { as: 'ana@lsbhandicrafts.test' });
    await page.route('**/auth/v1/logout**', (route) => {
      logouts.push(new URL(route.request().url()).searchParams.get('scope') ?? 'global');
      return route.fulfill({ status: 204, body: '' });
    });
    if (status === 'offline') await page.route('**/rest/v1/staff**', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'upstream unavailable' }),
    }));
    await page.goto(baseURL);
    await page.getByLabel('Username or email').fill('ana@lsbhandicrafts.test');
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(banner)).toBeVisible();
    expect(logouts).toEqual([scope]);
  });
}

test('failed product stock write retains inputs, focuses the error, and retries without a duplicate product', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  let fail = true;
  await page.route('**/rest/v1/inventory**', async (route) => {
    if (route.request().method() === 'POST' && fail) return route.fulfill({ status: 403,
      contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'permission denied' }) });
    await route.fallback();
  });
  await page.goto(`${baseURL}/products/new`);
  await page.getByLabel('Product name').fill('Regression product');
  await page.getByLabel('How wide across').fill('4');
  await page.getByLabel('Price', { exact: false }).fill('125');
  await page.getByLabel('How many on the shelf now').fill('20');
  await page.getByRole('button', { name: 'Save this product' }).click();
  await expect(page.locator('[data-form-error]')).toContainText('shelf count was not');
  await expect(page.locator('[data-form-error]')).toBeFocused();
  await expect(page.getByLabel('Product name')).toHaveValue('Regression product');
  await expect(page.getByLabel('How many on the shelf now')).toHaveValue('20');
  fail = false;
  await page.getByRole('button', { name: 'Save this product' }).click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  expect(tables.products.filter((row) => row.name === 'Regression product')).toHaveLength(1);
  expect(tables.inventory.filter((row) => row.name === 'Regression product')).toHaveLength(1);
});

test('customer failure stays open and invalid phone input never dispatches', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  let writes = 0;
  await page.route('**/rest/v1/customers**', async (route) => {
    if (route.request().method() === 'POST') {
      writes++;
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate email' }) });
    }
    await route.fallback();
  });
  await page.goto(`${baseURL}/customers`);
  await page.getByRole('button', { name: 'Add a customer', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/name/i).fill('Regression customer');
  const phone = dialog.locator('input[type="tel"]');
  await phone.fill('letters!'); await expect(phone).toHaveValue('');
  await phone.fill('123');
  await dialog.getByRole('button', { name: 'Add this customer' }).click();
  expect(writes).toBe(0);
  await phone.fill('09171234567');
  await dialog.getByRole('button', { name: 'Add this customer' }).click();
  await expect(dialog.locator('[data-form-error]')).toContainText('email address is already in use');
  await expect(dialog.locator('[data-form-error]')).toBeFocused();
  await expect(dialog.getByLabel(/name/i)).toHaveValue('Regression customer');
});

test('account provisioning sends a password and a late staff read cannot erase the new row', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  let release;
  let started;
  const readStarted = new Promise((resolve) => { started = resolve; });
  const delayed = new Promise((resolve) => { release = resolve; });
  let held = false;
  await page.route('**/rest/v1/staff**', async (route) => {
    if (route.request().method() === 'GET' && !held) {
      held = true; const snapshot = JSON.stringify(tables.staff); started(); await delayed;
      return route.fulfill({ contentType: 'application/json', body: snapshot });
    }
    await route.fallback();
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await readStarted;
  await page.getByRole('button', { name: /^Staff & accounts/ }).click();
  await page.getByRole('button', { name: 'Add a staff account', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Their name').fill('Regression staff');
  await dialog.getByRole('radio', { name: /Sales Staff/ }).click();
  await dialog.getByLabel('Email address').fill('regression@example.test');
  await dialog.getByLabel('First password').fill('ValidPass123');
  let payload;
  await page.route('**/functions/v1/admin-accounts', async (route) => {
    payload = route.request().postDataJSON();
    const row = { id: 99, name: payload.name, email: payload.email, role: payload.role, status: 'Active', contact_number: '' };
    tables.staff.push(row);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: row }) });
  });
  await dialog.getByRole('button', { name: 'Create the account' }).click();
  await expect(dialog).toHaveCount(0);
  expect(payload.password).toBe('ValidPass123');
  release();
  await expect(page.getByText('Regression staff', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Orders/ }).click();
  await page.getByRole('button', { name: /^Staff & accounts/ }).click();
  await expect(page.getByText('Regression staff', { exact: true })).toBeVisible();
});

test('order drag saves immediately, survives refresh, and rolls back on rejection', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  let reject = false;
  await page.route('**/rest/v1/rpc/reorder_orders', async (route) => {
    if (reject) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Permission denied.' }) });
    const { p_ids } = route.request().postDataJSON();
    tables.orders.forEach((row) => { row.priority_position = p_ids.indexOf(row.id) + 1; });
    return route.fulfill({ contentType: 'application/json', body: 'null' });
  });
  await page.goto(`${baseURL}/orders?layout=priority`);
  const items = page.locator('[data-order-id]');
  const original = await items.first().getAttribute('data-order-id');
  const second = await items.nth(1).getAttribute('data-order-id');
  await items.first().dragTo(items.nth(1));
  await expect(items.first()).toHaveAttribute('data-order-id', second);
  await expect(page.getByText('Order priority saved.')).toBeVisible();
  await page.reload();
  await expect(items.first()).toHaveAttribute('data-order-id', second);
  reject = true;
  await page.getByRole('button', { name: `Move order ${second} down`, exact: true }).click();
  await expect(page.getByText('The previous order has been restored.')).toBeVisible();
  await expect(items.first()).toHaveAttribute('data-order-id', second);
  expect(original).not.toBe(second);
});

test('a dashboard alert preserves its selected tab on refresh', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page).toHaveURL(/\/products\?tab=low$/);
  await page.reload();
  await expect(page).toHaveURL(/\/products\?tab=low$/);
  await expect(page.getByRole('radio', { name: /Running low/ })).toHaveAttribute('aria-checked', 'true');
});

test('failed account creation retains credentials, and a retry adds the row', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff`);
  await page.getByRole('button', { name: 'Add a staff account', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Their name').fill('New colleague');
  await dialog.getByRole('radio', { name: /Sales Staff/ }).click();
  await dialog.getByLabel('Email address').fill('new@example.test');
  await dialog.getByLabel('First password').fill('ValidPass123');
  let fail = true;
  await page.route('**/functions/v1/admin-accounts', async (route) => {
    if (fail) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'That username is already taken.' }) });
    const row = { id: 101, name: 'New colleague', email: 'new@example.test', role: 'Sales Staff', status: 'Active' };
    tables.staff.push(row);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: row }) });
  });
  await dialog.getByRole('button', { name: 'Create the account' }).click();
  await expect(dialog.locator('[data-form-error]')).toHaveText('That username is already taken.');
  await expect(dialog.locator('[data-form-error]')).toBeFocused();
  await expect(dialog.getByLabel('First password')).toHaveValue('ValidPass123');
  fail = false;
  await dialog.getByRole('button', { name: 'Create the account' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('New colleague', { exact: true })).toBeVisible();
});

test('deleted staff stays absent after refresh and loses application access', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff/2`);
  await page.getByRole('button', { name: 'Remove Juan Dela Cruz', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove them', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/staff`);
  expect(tables.staff.some((row) => row.id === 2)).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Staff & accounts' })).toBeVisible();
  await expect(page.getByText('Juan Dela Cruz', { exact: true })).toHaveCount(0);
  // Simulate a still-unexpired token for the deleted user: fresh staff, not
  // token claims or old browser caches, must decide whether the app opens.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-')) continue;
      const session = JSON.parse(localStorage.getItem(key));
      if (session?.user) { session.user.email = 'juan@lsbhandicrafts.test'; localStorage.setItem(key, JSON.stringify(session)); }
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

test('desktop sidebar stays anchored through forms and dialogs; phone has no horizontal overflow', async ({ page, baseURL }) => {
  await stubSupabase(page); await signIn(page, baseURL);
  const nav = page.getByRole('button', { name: /^Products & stock/ });
  const before = await nav.boundingBox();
  await nav.click();
  await page.getByRole('button', { name: 'Add a product', exact: true }).first().click();
  expect((await nav.boundingBox()).x).toBe(before.x);
  await page.getByRole('button', { name: /^Staff & accounts/ }).click();
  await page.getByRole('button', { name: 'Add a staff account', exact: true }).first().click();
  expect((await page.getByRole('button', { name: /^Products & stock/, includeHidden: true }).first().boundingBox()).x).toBe(before.x);
  await page.screenshot({ path: 'test-results/remediation-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/orders?layout=priority`);
  await expect(page.locator('[data-order-id]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/remediation-mobile.png', fullPage: true, animations: 'disabled' });
});

/**
 * A cut-to-size line survives an unrelated edit.
 *
 * Order #1041 carries one: twelve finished pieces cut from three parent sheets,
 * with the cutting instructions in its notes. The form can only BUILD catalogue,
 * negotiated and by-hand lines, so re-saving the order used to rewrite the cut
 * line as one of those -- kind flipped, notes dropped, and the draw rewritten
 * from three sheets to twelve. The order then reserved, and later deducted, four
 * times the stock it should have, because somebody changed the address.
 */
test('editing an order leaves its cut-to-size line alone', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);

  const before = tables.orders.find((row) => row.id === 1041).items
    .find((line) => line.kind === 'cut');
  expect(before, 'fixture should carry a cut line').toBeTruthy();

  await page.goto(`${baseURL}/orders/1041/edit`);
  await expect(page.getByRole('heading', { level: 1, name: 'Change this order' })).toBeVisible();
  await page.getByRole('button', { name: 'Save the changes' }).click();
  await expect(page).toHaveURL(/\/orders\/1041$/);

  const after = tables.orders.find((row) => row.id === 1041).items
    .find((line) => line.name === before.name);
  expect(after.kind).toBe('cut');
  // Three parent sheets, not twelve pieces.
  expect(after.stockUnits).toBe(before.stockUnits);
  expect(after.notes).toBe(before.notes);
  expect(after.quantity).toBe(before.quantity);
});

/**
 * An arrived delivery finishes the order it was carrying.
 *
 * Dispatching moved the stock and flipped the delivery, and arriving flipped the
 * delivery again -- but nothing ever touched the order. It sat at Pending for
 * ever while its own progress tracker read the delivery and said "Delivered",
 * it kept counting in the waiting total and in the customer's open-order badge,
 * and somebody had to remember to press "Mark as done" on an order that had
 * demonstrably already gone out.
 */
test('a delivery that arrives with nothing left owed finishes its order', async ({ page, baseURL }) => {
  const tables = await stubSupabase(page); await signIn(page, baseURL);
  expect(tables.orders.find((row) => row.id === 1042).status).toBe('Pending');

  await page.getByRole('button', { name: /^Deliveries/ }).click();
  await page.getByRole('button', { name: /Liza Villanueva/ }).click();

  // Send the whole order out, so nothing is left owed on it.
  await page.getByRole('button', { name: /It is on the way/ }).click();
  await expect(page.getByRole('heading', { name: 'What actually went out?' })).toBeVisible();
  await page.getByRole('button', { name: /Yes, it is on the way/ }).click();
  await expect(page.getByText(/is now on the way/)).toBeVisible();

  await page.getByRole('button', { name: /It arrived/ }).click();
  await expect(page.getByText(/order #1042 is done/)).toBeVisible();

  expect(tables.orders.find((row) => row.id === 1042).status).toBe('Completed');
});
