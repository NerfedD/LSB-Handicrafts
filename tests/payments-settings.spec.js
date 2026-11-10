/**
 * The features that were drawn but had nowhere to keep their data: payments,
 * the business's own settings, staff photos, and signing somebody else out.
 * Each was a disabled control; these check the wire now reaches the database
 * (the stub answers the way the real functions do).
 */
import { test, expect } from "@playwright/test";
import { signIn, stubSupabase } from "./stubSupabase.js";

// 1041: Reyes Events, ₱6,280.00, nothing paid yet.
const REYES = 1041;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** The totals under the order's items, as { label: value }. */
function totalsOf(page) {
  return page.getByRole("region", { name: "Items", exact: true }).locator("dl").evaluate((dl) =>
    Object.fromEntries([...dl.querySelectorAll("dt")].map((dt) => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()])));
}

test("a payment recorded on an order shows what is paid and what is still owed", async ({ page, baseURL }) => {
  const writes = [];
  await stubSupabase(page, { onWrite: (w) => writes.push(w) });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/${REYES}`);

  const panel = page.getByRole("region", { name: "Payments", exact: true });
  await expect(panel.getByText("No payment has been recorded on this order.")).toBeVisible();

  // Used to be disabled with "Payments are not recorded in the system yet".
  await panel.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await expect(dialog).toContainText("owes ₱6,280.00");
  await dialog.getByLabel(/^Amount received/).fill("2000");
  await dialog.getByRole("radio", { name: "GCash" }).click();
  // Anything but cash is traced by the number on its receipt.
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByLabel(/^Reference number/)).toHaveAccessibleDescription(/reference number/i);
  await dialog.getByLabel(/^Reference number/).fill("GC-778812");
  await expect(dialog).toContainText("₱4,280.00");
  await dialog.getByRole("button", { name: "Record payment" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("₱2,000.00 recorded.")).toBeVisible();
  await expect(panel.getByRole("list", { name: "Payments received" })).toContainText("₱2,000.00 received · GCash · GC-778812");
  await expect(panel).toContainText("Still owed₱4,280.00");
  // The totals under the items say the same, the way the printed slip does.
  await expect.poll(() => totalsOf(page)).toMatchObject({ "Paid": "−₱2,000.00", "What they still owe": "₱4,280.00" });
  expect(writes.find((w) => w.table === "order_payments")?.row).toMatchObject({ order_id: REYES, amount: 2000, method: "gcash" });

  // A manager can take one back that was entered by mistake.
  await panel.getByRole("button", { name: "Remove the ₱2,000.00 payment" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove payment" }).click();
  await expect(panel.getByText("No payment has been recorded on this order.")).toBeVisible();
  // Nothing paid and nothing given back: the order total is the whole story.
  await expect.poll(() => totalsOf(page)).not.toHaveProperty("What they still owe");
});

// The order screen said what was owed in two places that did not agree: the
// totals took off refunds only, the Payments panel took off payments as well.
test("an order's totals take payments off what is still owed, as the Payments panel and the slip do", async ({ page, baseURL }) => {
  await stubSupabase(page, {
    seed: (tables) => {
      // ₱6,280.00, of which ₱1,000.00 was given back and ₱2,000.00 has been paid.
      Object.assign(tables.orders.find((o) => o.id === REYES), {
        refunded_amount: 1000,
        refund_history: [{ id: 5101, amount: 1000, refundedAt: new Date().toISOString(), refundedBy: "Maria Santos", reason: "changed-mind", method: "cash", restockedItems: [] }],
      });
      tables.order_payments.push({ id: 7101, order_id: REYES, amount: 2000, method: "cash", reference: null,
        received_on: new Date().toISOString().slice(0, 10), note: null, recorded_by: "Maria Santos", created_at: new Date().toISOString() });
    },
  });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/${REYES}`);

  await expect.poll(() => totalsOf(page)).toMatchObject({
    "Order total": "₱6,280.00",
    "Given back": "−₱1,000.00",
    "Paid": "−₱2,000.00",
    "What they still owe": "₱3,280.00",
  });
  await expect(page.getByRole("region", { name: "Payments", exact: true })).toContainText("Still owed₱3,280.00");
  await expect(page.locator(".slip .slip-total-row").filter({ hasText: "What they still owe" })).toContainText("₱3,280.00");
});

test("a cancelled order does not say anything is still owed, even when only part was given back", async ({ page, baseURL }) => {
  await stubSupabase(page, {
    seed: (tables) => {
      // #1044 is cancelled; here ₱300.00 of its ₱840.00 went back rather than all of it.
      const order = tables.orders.find((o) => o.id === 1044);
      order.refunded_amount = 300;
      order.refund_history[0].amount = 300;
    },
  });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/1044`);
  await expect(page.getByText("This order was cancelled.")).toBeVisible();

  const totals = await totalsOf(page);
  expect(totals).toMatchObject({ "Order total": "₱840.00", "Given back": "−₱300.00" });
  expect(totals).not.toHaveProperty("What they still owe");
  await expect(page.getByRole("region", { name: "Payments", exact: true })).toContainText("Still owed—");
  await expect(page.locator(".slip")).not.toContainText("What they still owe");
});

test("a customer's payment is offered against every order they still owe on", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Reyes Events" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  // Reyes Events owes on one order only, so there is nothing to choose between.
  await expect(dialog).toContainText("Reyes Events owes ₱6,280.00.");
  await expect(dialog.getByLabel(/^Amount received/)).toHaveValue("6280.00");
});

test("money paid on a pick-up order as it is written lands on the order", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/new`);
  const form = page.getByRole("dialog", { name: "New order" });
  await form.getByLabel(/^Customer/).fill("Walk-in buyer");
  await form.getByLabel("Item").click();
  await page.getByRole("option", { name: /Styro Ball 4 inch/ }).click();
  await form.getByLabel("How many").fill("2");
  // No address: picked up at the shop, so it can be paid now, in full or in part.
  await form.getByLabel(/^Paid now/).fill("100");
  await expect(form).toContainText("Still to pay at pick-up");
  await form.getByRole("button", { name: /Create (order|it anyway)/ }).click();
  // No address, so the form asks once whether it is being collected.
  const again = form.getByRole("button", { name: "Create it anyway" });
  if (await again.isVisible().catch(() => false)) await again.click();

  await expect(page).toHaveURL(/\/orders\/\d+$/);
  await expect(page.getByText(/paid now/)).toBeVisible();
  const panel = page.getByRole("region", { name: "Payments", exact: true });
  await expect(panel.getByRole("list", { name: "Payments received" })).toContainText("₱100.00 received · Cash");
});

test("the business settings save, and the order slip prints them", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/settings-general`);

  await expect(page.getByText("Nothing on this screen can be saved yet")).toHaveCount(0);
  await page.getByLabel(/^Phone/).fill("(082) 221 1234");
  await page.getByLabel(/^TIN/).fill("123-456-789-000");
  await page.getByRole("switch", { name: "VAT registered" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("The settings were saved.")).toBeVisible();

  await page.goto(`${baseURL}/orders/${REYES}`);
  await page.emulateMedia({ media: "print" });
  const slip = page.locator(".slip");
  await expect(slip).toContainText("(082) 221 1234");
  await expect(slip).toContainText("TIN 123-456-789-000");
  await expect(slip).toContainText("VAT (12%) included");
});

test("a person can put their own photo on their profile, and take it off again", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/profile`);

  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Your photo was saved.")).toBeVisible();
  // The account chip at the foot of the sidebar shows it too.
  await expect(page.getByRole("button", { name: /^Account menu for/ }).locator("img")).toHaveCount(1);

  await page.getByRole("button", { name: "Use initials" }).click();
  await expect(page.getByText("Your initials are back.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Account menu for/ }).locator("img")).toHaveCount(0);
});

test("an administrator can sign somebody else out everywhere", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff/2`);

  const button = page.getByRole("button", { name: "Sign out everywhere" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText(/Signed out of 2 devices/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Signed out everywhere" })).toBeDisabled();

  // Not offered on your own account: My profile does that.
  await page.goto(`${baseURL}/staff/1`);
  await expect(page.getByRole("button", { name: "Sign out everywhere" })).toHaveCount(0);
});

test("a delivered order is on terms: nothing paid down, and nothing for the driver to collect", async ({ page, baseURL }) => {
  const writes = [];
  await stubSupabase(page, { onWrite: (w) => writes.push(w) });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/orders/new`);
  const form = page.getByRole("dialog", { name: "New order" });
  await form.getByLabel(/^Customer/).fill("Reyes Events");
  await form.getByLabel("Item").click();
  await page.getByRole("option", { name: /Styro Ball 4 inch/ }).click();
  await form.getByLabel("How many").fill("2");
  await form.getByLabel("Where to").fill("12 Mabini St, Poblacion, Davao City");

  // A delivered order takes no money up front; it is given a term instead.
  await expect(form.getByLabel(/^Paid now/)).toHaveCount(0);
  await expect(form.getByRole("radio", { name: "30 days" })).toHaveAttribute("aria-checked", "true");
  await form.getByRole("radio", { name: "60 days" }).click();
  await expect(form).toContainText("Due 60 days after delivery");
  await form.getByRole("button", { name: /Create (order|it anyway)/ }).click();

  await expect(page).toHaveURL(/\/orders\/\d+$/);
  expect(writes.find((w) => w.table === "orders" && w.method === "POST")?.row).toMatchObject({ payment_term_days: 60 });
  const panel = page.getByRole("region", { name: "Payments", exact: true });
  await expect(panel).toContainText("60 days from delivery · due once it is delivered");
});

test("a supplier order paid by card counts as paid as soon as it is placed", async ({ page, baseURL }) => {
  const tables = await stubSupabase(page);
  tables.suppliers.push({ id: 6100, name: "Foamtech Manila", status: "Active", revision: 0 });
  tables.raw_materials.push({ id: 6200, sku: "RM-ADH-001", name: "Glue, foam-safe", unit: "bottle", stock: 3, low_stock_threshold: 4, status: "Active", revision: 0 });
  // workshop_command places the order as the database would; how it is paid
  // is set after, by set_supplier_payment, which the shared stub answers.
  await page.route("**/rest/v1/rpc/workshop_command", async (route) => {
    const { p_data: data } = route.request().postDataJSON();
    const row = { id: 8800, status: "Ordered", quantity_arrived: 0, quantity_lost_transit: 0, claim_status: "None",
      total_cost: Number(data.quantity_ordered) * Number(data.unit_price), payment_method: "cod", paid_at: null, ...data,
      supplier_id: Number(data.supplier_id), raw_material_id: Number(data.raw_material_id), quantity_ordered: Number(data.quantity_ordered) };
    tables.raw_material_orders.push(row);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(row) });
  });
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/raw-material-orders`);
  await page.getByRole("button", { name: "New supplier order" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New supplier order" });
  await dialog.getByLabel(/^Material/).selectOption({ label: "Glue, foam-safe (RM-ADH-001)" });
  await dialog.getByLabel(/^Supplier/).selectOption({ label: "Foamtech Manila" });
  await dialog.getByLabel(/^How much/).fill("5");
  await dialog.getByLabel(/^Agreed price/).fill("380");
  await dialog.getByLabel(/^Paid by/).selectOption("card");
  await dialog.getByRole("button", { name: "Place order" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("table", { name: "Supplier orders" })).toContainText("Card · paid");
});
