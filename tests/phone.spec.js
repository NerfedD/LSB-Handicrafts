/**
 * The phone field, end to end.
 *
 * ONE SHAPE NOW: eleven digits beginning 09. The field enforces it as the
 * number is typed rather than complaining at the end of the form.
 *
 * The round trip is still the case worth holding onto, and it is the one this
 * rule most easily breaks. Every number in the seed data was stored with
 * spaces, under the old rule that allowed them. The field's `pattern` is digits
 * now, so a stored `0917 555 0201` put straight into the box would fail it, and
 * guardForm would refuse the submit with the browser's own "Please match the
 * requested format" — on a screen somebody opened to change an address. The
 * value is therefore normalised on the way in, and the assertions below are
 * what proves it: a record has to be saveable from the screen that displays it,
 * without editing a field nobody came here to touch.
 */
import { test, expect } from "@playwright/test";
import { stubSupabase, signIn } from "./stubSupabase.js";

test("a stored number written with spaces is shown as digits and saves back", async ({
  page,
  baseURL,
}) => {
  const tables = await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByRole("button", { name: /Edit/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // The seed writes every number with spaces; the box shows the same number in
  // the shape the rule now keeps.
  const shown = await dialog.getByLabel(/Phone number/).inputValue();
  expect(shown, "the stored punctuation is absorbed, not carried into the box").toMatch(
    /^09\d{9}$/
  );

  await dialog.getByLabel(/Where they are/).fill("9 Torres St, Poblacion, Davao City");
  await dialog.getByRole("button", { name: /Save/ }).click();

  // The submit is not refused, which is the whole point of normalising on entry.
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("9 Torres St");

  // And the number was written back in the canonical shape rather than left in
  // two spellings across the table.
  const saved = tables.customers.find((row) => row.address?.includes("9 Torres St"));
  expect(saved.contact_number).toMatch(/^09\d{9}$/);
});

test("the box holds digits only, eleven of them, and converts +63 as it is typed", async ({
  page,
  baseURL,
}) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  const phone = dialog.getByLabel(/Phone number/);

  // The field has to be WEARING the phone treatment, not merely be cleaned by
  // the form around it. Every form here also calls cleanPhoneInput in its own
  // onChange, so typing looks correct even when the shared Input has stopped
  // recognising the field at all -- which is exactly what happened when these
  // callers were switched to inputMode="numeric", the prop the component keys
  // on. These three attributes come only from the component.
  await expect(phone).toHaveAttribute("type", "tel");
  // 32, not 11: the browser applies maxlength to a PASTE before the punctuation
  // is stripped, so a cap of eleven would cut digits off "0917 555 0201".
  await expect(phone).toHaveAttribute("maxlength", "32");
  await expect(phone).toHaveAttribute("pattern", "[0-9]*");
  // Digits only, so the keypad is the digits one rather than the telephone one
  // that carries + and *.
  await expect(phone).toHaveAttribute("inputmode", "numeric");

  // Punctuation is absorbed rather than refused: the number somebody always
  // writes with spaces still goes in, and comes out as the one stored shape.
  await phone.fill("0917 555 0201");
  await expect(phone).toHaveValue("09175550201");

  // An international number is the same number written for abroad, so it is
  // converted rather than rejected.
  await phone.fill("+63 917 123 4503");
  await expect(phone).toHaveValue("09171234503");

  // A twelfth digit never lands at all — the value that got into the live
  // database while nothing was checking cannot be typed any more.
  await phone.fill("");
  await phone.pressSequentially("091212121212");
  await expect(phone).toHaveValue("09121212121");

  // A letter never lands in the box either.
  await phone.fill("");
  await phone.pressSequentially("0917 call");
  await expect(phone).toHaveValue("0917");
});

test("too few digits is refused in words, naming the count", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
  await dialog.getByLabel(/Phone number/).fill("0912");
  await dialog.getByRole("button", { name: /Save|Add/ }).click();

  // phoneProblem's sentence, which names the count and therefore where to look.
  await expect(dialog).toContainText("that has 4");
  await expect(dialog).not.toContainText("Please match the requested format");
  await expect(dialog).toBeVisible();
});

test("a landline is refused, and says so by its count", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
  // Ten digits once the punctuation is absorbed. This is the deliberate cost of
  // the one-shape rule, and it is asserted so the loss stays visible.
  await dialog.getByLabel(/Phone number/).fill("(02) 8888 8888");
  await dialog.getByRole("button", { name: /Save|Add/ }).click();

  await expect(dialog).toContainText("that has 10");
  await expect(dialog).toBeVisible();
});

test("there is no 'save it anyway' left to press", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
  // The number that used to raise "That is 12 digits — save it anyway?" cannot
  // be typed, and nothing that can be typed is merely surprising any more.
  await dialog.getByLabel(/Phone number/).fill("091212121212");
  await expect(dialog.getByLabel(/Phone number/)).toHaveValue("09121212121");
  await expect(dialog).not.toContainText("Save it anyway");
});

test("the staff screen checks the number it stopped getting checked for free", async ({
  page,
  baseURL,
}) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/staff`);
  await page.getByRole("button", { name: /Open|Manage/ }).first().click();

  const phone = page.getByLabel(/Phone number/);
  await expect(phone).toBeVisible();
  await phone.fill("0912");
  await page.getByRole("button", { name: /Save/ }).first().click();
  await expect(page.getByRole("main")).toContainText("that has 4");
});
