/**
 * The four features that were drawn but never connected.
 *
 * Each of these was a button the design asked for and the app showed disabled,
 * with a `title` saying why. These check that the wire now reaches the far end:
 * two print paths that produce a document rather than a screenshot of the app,
 * and two auth calls that really go to Supabase.
 *
 * The print cases emulate print media rather than trusting that a screen
 * render implies a page one -- the whole point of .slip is that it is
 * display:none until a print, so a screen assertion proves nothing about it.
 */
import { test, expect } from "@playwright/test";
import { signIn, stubSupabase } from "./stubSupabase.js";

const OUT = "test-results/tier-a";

// 2044: Cielo Dizon, on the way, Ramon Garcia driving, a charge to collect and
// no manifest -- so the slip falls back to the delivery's own size line, which
// is the common case on this data.
const ON_THE_WAY = 2044;
// 2043: already delivered, so the slip is a record rather than a form.
const ARRIVED = 2043;

async function openDelivery(page, baseURL, id) {
  await page.goto(`${baseURL}/deliveries/${id}`);
  await expect(page.getByRole("button", { name: "Back to Deliveries" })).toBeVisible();
}

test("the delivery slip is printable, and is a document rather than the app", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openDelivery(page, baseURL, ON_THE_WAY);

  // The button used to be disabled with "There is no delivery slip to print yet".
  const print = page.getByRole("button", { name: "Print delivery slip" });
  await expect(print).toBeEnabled();

  // On screen the slip is mounted but invisible, and the app is what shows.
  await expect(page.locator(".slip")).toHaveCount(1);
  await expect(page.locator(".slip")).toBeHidden();
  await expect(page.locator("#root")).toBeVisible();

  await page.emulateMedia({ media: "print" });

  // The application, sidebar and all, must not reach the paper.
  await expect(page.locator("#root")).toBeHidden();

  const slip = page.locator(".slip");
  await expect(slip).toBeVisible();
  await expect(slip).toContainText("LSB Handicrafts");
  await expect(slip).toContainText("Delivery slip");
  await expect(slip).toContainText("Cielo Dizon");
  await expect(slip).toContainText("Km 9, Matina");
  await expect(slip).toContainText("Ramon Garcia");
  // What is on the truck, from the delivery's own size line.
  await expect(slip).toContainText("Styro Ball 4 inch");
  // The charge is the one amount a driver may be asked to collect.
  await expect(slip).toContainText("Delivery charge");
  // The signature block is why this is printed at all.
  await expect(slip).toContainText("Received by");
  await expect(slip).toContainText("This is not an official receipt");
  // The office number is still the mockup placeholder, so it must not appear
  // on a sheet going to a customer -- a wrong number is worse than none.
  await expect(slip).not.toContainText("(082) 000 0000");

  await page.screenshot({ path: `${OUT}/delivery-slip.png`, fullPage: true });
});

test("a delivered run prints as a record, with no signature left to give", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openDelivery(page, baseURL, ARRIVED);
  await page.emulateMedia({ media: "print" });

  const slip = page.locator(".slip");
  await expect(slip).toBeVisible();
  await expect(slip).toContainText("Marked arrived");
  // Asking for a signature that was already given is how a filed slip turns
  // into an argument about whether it ever arrived.
  await expect(slip).not.toContainText("Received by");
});

test("the delivery slip fits one sheet of A4", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openDelivery(page, baseURL, ON_THE_WAY);

  // A real PDF, not emulateMedia: emulating applies the stylesheet but does
  // not paginate, so it says nothing about whether the thing fits a page.
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages).toBe(1);

  // And nothing off the edge at the width the content column actually gets:
  // A4 less 15mm of margin each side is 180mm, about 680px at 96dpi.
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 680, height: 1000 });
  const overflow = await page.locator(".slip").evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the run sheet prints the round, grouped by whose truck it is on", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/deliveries`);
  await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();

  // Used to be disabled with "The run sheet is not printable yet".
  await expect(page.getByRole("button", { name: "Print run sheet" })).toBeEnabled();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#root")).toBeHidden();

  const sheet = page.locator(".slip");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Run sheet");
  // Grouped by driver, with the unassigned stops gathered at the end rather
  // than scattered through the list.
  await expect(sheet).toContainText("Ramon Garcia");
  await expect(sheet).toContainText("No driver yet");
  // A stop carries where it is going, not just who it is for.
  await expect(sheet).toContainText("Poblacion");
  await expect(sheet).toContainText("Every delivery");
  await expect(sheet).toContainText("Working sheet, not a receipt");

  await page.screenshot({ path: `${OUT}/run-sheet.png`, fullPage: true });
});

test("the run sheet prints what the filters left on screen", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/deliveries`);
  await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();

  // Narrow the board to one driver. Printing the whole table instead would
  // mean filtering on paper afterwards with a pen.
  await page.getByRole("combobox", { name: "Driver" }).click();
  await page.getByRole("option", { name: "Ramon Garcia" }).click();

  await page.emulateMedia({ media: "print" });
  const sheet = page.locator(".slip");
  await expect(sheet).toContainText("Ramon Garcia");
  // The filtered-out stops are genuinely absent from the paper.
  await expect(sheet).not.toContainText("No driver yet");
});

test("a person can end every other sign-in but their own", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/profile`);

  // Used to be disabled with "Not available yet".
  const button = page.getByRole("button", { name: "Sign out everywhere else" });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText("Every other sign-in was ended")).toBeVisible();
  // THE ASYMMETRY IS THE POINT: this session survives, so nobody locks
  // themselves out of the screen they are standing on.
  await expect(page.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeVisible();
});

test("an admin can post a reset link to an account's own email", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  // Juan, not Maria: the point is resetting somebody else's password without
  // ever learning it.
  await page.goto(`${baseURL}/staff/2`);
  await expect(page.getByRole("button", { name: "Back to User Management" })).toBeVisible();

  // Used to be disabled with "Password resets are sent from the sign-in screen".
  const button = page.getByRole("button", { name: "Send password reset" });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText("Sent to juan@lsbhandicrafts.test")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset link sent" })).toBeDisabled();
});

test("an admin can post a reset link from the user list's row menu", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff`);

  let recovered = null;
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/recover")) recovered = request.postDataJSON();
  });

  await page.getByRole("button", { name: "Actions for Juan Dela Cruz" }).click();
  // Used to be a disabled menu item with nothing behind it.
  const item = page.getByRole("menuitem", { name: "Reset password" });
  await expect(item).toBeEnabled();
  await item.click();

  await expect(page.getByText("Reset link sent to juan@lsbhandicrafts.test")).toBeVisible();
  expect(recovered?.email).toBe("juan@lsbhandicrafts.test");
});

test("the dashboard's Add menu reaches the product form and the customer dialog", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/dashboard`);

  // App passed these handlers all along; the redesigned dashboard dropped the buttons.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add customer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Over the Customers list, not the dashboard, the same way Add product goes to Products.
  await expect(page).toHaveURL(/\/customers$/);
  await page.keyboard.press("Escape");
  await page.goto(`${baseURL}/dashboard`);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add product" }).click();
  // A dialog over Inventory, like Add customer over Customers.
  await expect(page.getByRole("dialog", { name: "Add product" })).toBeVisible();
  await expect(page).toHaveURL(/\/products$/);
});

test("the Add menu offers only what the role may add", async ({ page, baseURL }) => {
  await stubSupabase(page, { as: "juan@lsbhandicrafts.test" });
  await signIn(page, baseURL, "juan@lsbhandicrafts.test");
  await page.goto(`${baseURL}/dashboard`);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Add customer" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Add product" })).toHaveCount(0);
});
