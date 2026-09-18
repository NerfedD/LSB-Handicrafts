/**
 * The phone field, end to end.
 *
 * Every number in the seed data is written with spaces, the way this business
 * writes them and the way utils/phone and the contact_number_ok constraint both
 * allow. The field itself disagreed: it carried `pattern="[0-9]{7,15}"`, so
 * guardForm found it invalid and refused the submit with the browser's own
 * "Please match the requested format". Opening any existing customer, changing
 * their address, and pressing Save did nothing.
 *
 * The round trip is the case worth holding onto: a record has to be saveable
 * from the screen that displays it, without editing a field nobody touched.
 */
import { test, expect } from "@playwright/test";
import { stubSupabase, signIn } from "./stubSupabase.js";

test("a stored number written with spaces saves back untouched", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByRole("button", { name: /Edit/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Read it off the field rather than out of the fixture: the list is sorted by
  // name, so which customer opens first is not which row the seed array starts
  // with. What matters is the shape, and the seed writes every number this way.
  const stored = await dialog.getByLabel(/Phone number/).inputValue();
  expect(stored, "the fixture has to carry the shape that was broken").toContain(" ");

  // The number is left exactly as it was stored. Nothing else in this app asks
  // somebody to retype a field they did not come here to change.
  await dialog.getByLabel(/Where they are/).fill("9 Torres St, Poblacion, Davao City");
  await dialog.getByRole("button", { name: /Save/ }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("9 Torres St");
});

test("the field accepts the punctuation people write, and refuses letters", async ({
  page,
  baseURL,
}) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  const phone = dialog.getByLabel(/Phone number/);

  // A numeric keypad has no + on it, which is why this is inputMode="tel".
  await expect(phone).toHaveAttribute("inputmode", "tel");

  // Sixteen characters. The old maxLength of 15 cut the last digit off this
  // number, which utils/phone offers as an example of a valid one.
  await phone.fill("+63 917 123 4503");
  await expect(phone).toHaveValue("+63 917 123 4503");

  // A letter never lands in the box at all — it is stripped as it is typed,
  // rather than accepted and complained about on submit.
  await phone.fill("");
  await phone.pressSequentially("0917 call");
  await expect(phone).toHaveValue("0917 ");
});

test("too few digits is refused in words, not by the browser", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/customers`);
  await page.getByRole("button", { name: "Add a customer" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
  await dialog.getByLabel(/Phone number/).fill("0912");
  await dialog.getByRole("button", { name: /Save|Add/ }).click();

  // phoneProblem's sentence, which names the count and therefore where to look.
  await expect(dialog).toContainText("at least 7 digits");
  await expect(dialog).not.toContainText("Please match the requested format");
  await expect(dialog).toBeVisible();
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
  await expect(page.getByRole("main")).toContainText("at least 7 digits");
});
