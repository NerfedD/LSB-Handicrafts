/**
 * The printed order slip.
 *
 * Printing used to be `window.print()` against a page with no print stylesheet,
 * so what came out was the application: sidebar, header, account menu, and the
 * red block offering to delete the order. These check that what reaches paper
 * is the document instead, and they emulate print media rather than trusting
 * that a screen render implies a page one.
 */
import { test, expect } from "@playwright/test";
import { stubSupabase, signIn } from "./stubSupabase.js";

const OUT = "test-results/slip";

async function openAnOrder(page, baseURL) {
  await page.goto(`${baseURL}/orders`);
  await expect(page.getByRole("main").getByText("#104").first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByRole("main").getByText("All orders").first()).toBeVisible();
}

test("on screen the slip is invisible and the app is not", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openAnOrder(page, baseURL);

  await expect(page.locator(".slip")).toHaveCount(1);
  await expect(page.locator(".slip")).toBeHidden();
  await expect(page.locator("#root")).toBeVisible();
});

test("in print the app is gone and the document is what remains", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openAnOrder(page, baseURL);

  await page.emulateMedia({ media: "print" });

  // The whole application, including the sidebar and every destructive control
  // that used to print alongside the order.
  await expect(page.locator("#root")).toBeHidden();
  await expect(page.getByText("Call off order")).toBeHidden();

  const slip = page.locator(".slip");
  await expect(slip).toBeVisible();
  await expect(slip).toContainText("LSB Handicrafts");
  await expect(slip).toContainText("Order slip");
  await expect(slip).toContainText("Total to pay");
  await expect(slip).toContainText("Received by");
  // A live order says where it stands too, in the app's own plain word.
  await expect(slip).toContainText("Waiting");

  // The claim it must never make.
  await expect(slip).toContainText("This is not an official receipt");

  // The office number is still the mockup placeholder, so it must not appear on
  // a page going to a customer -- a wrong number is worse than no number.
  await expect(slip).not.toContainText("(082) 000 0000");

  await page.screenshot({ path: `${OUT}/slip-print.png`, fullPage: true });
});

test("the slip is a real page: A4, one sheet, nothing off the edge", async ({
  page,
  baseURL,
}) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  await openAnOrder(page, baseURL);

  // A REAL PDF, NOT emulateMedia. Emulating print media applies the stylesheet
  // but does not paginate: the article simply fills the 1440px viewport, so
  // measuring it there says nothing about whether it fits a sheet of A4. Asking
  // the browser to actually render the page is the only check that exercises
  // `@page` and the break-inside rules at the same time.
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

  // A five-line order on two sheets means the layout is wrong, not the order.
  expect(pages).toBe(1);
  expect(pdf.length).toBeGreaterThan(1000);

  // And a look at it, at the width the content column actually gets: A4 is
  // 210mm less 15mm of margin each side, which is 180mm, about 680px at 96dpi.
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 680, height: 1000 });
  const overflow = await page
    .locator(".slip")
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${OUT}/slip-a4-column.png`, fullPage: true });
});

/** Open one specific order by number, rather than whichever sorts first. */
async function openOrderNumbered(page, baseURL, number) {
  await page.goto(`${baseURL}/orders`);
  await expect(page.getByRole("main").getByText("#104").first()).toBeVisible();
  await page.getByPlaceholder(/Search by customer or order number/).fill(String(number));
  await expect(page.getByRole("main").getByText(`#${number}`).first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByRole("main").getByText("All orders").first()).toBeVisible();
}

test("a corrected price reaches the paper", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  // #1046 carries a real price adjustment in the fixtures.
  await openOrderNumbered(page, baseURL, 1046);
  await page.emulateMedia({ media: "print" });

  const slip = page.locator(".slip");
  await expect(slip).toBeVisible();
  // A slip that quietly drops a price correction is the one that causes an
  // argument at the counter, so its absence is the thing worth failing on.
  await expect(slip).toContainText("The price was corrected");
  await page.screenshot({ path: `${OUT}/slip-corrected.png`, fullPage: true });
});

test("a refund reaches the paper, and so does what is left owing", async ({ page, baseURL }) => {
  await stubSupabase(page);
  await signIn(page, baseURL);
  // #1044 was refunded in full in the fixtures.
  await openOrderNumbered(page, baseURL, 1044);
  await page.emulateMedia({ media: "print" });

  const slip = page.locator(".slip");
  await expect(slip).toBeVisible();
  await expect(slip).toContainText("was given back");
  await expect(slip).toContainText("What they still owe");
  // #1044 is a cancelled order. A slip that reads the same whether the goods
  // are coming or not is the one that gets somebody waiting for a delivery
  // that was called off weeks ago.
  await expect(slip).toContainText("Called off");
  await page.screenshot({ path: `${OUT}/slip-refunded.png`, fullPage: true });
});
