/**
 * Screenshot pass for the motion work. Not an assertion suite — it drives the
 * app along the paths the animation exists for and captures them, desktop and
 * phone in one run, so a design pass can look at what actually renders rather
 * than at what the CSS claims.
 *
 * The landing wash is paused mid-hold before each capture, because a 900ms
 * animation is otherwise over before a screenshot lands.
 */
import { test, expect } from "@playwright/test";
import { stubSupabase, signIn } from "./stubSupabase.js";

const OUT = "test-results/motion";

/** Freeze the landing wash mid-hold so a still frame shows what it looks like. */
async function hold(page) {
  await page.addStyleTag({
    content: `.lsb-landed, .lsb-landed-row {
      animation-play-state: paused !important; animation-delay: -300ms !important; }`,
  });
}

/** Wait for the screen itself, not the Suspense spinner that precedes it. */
async function onScreen(page, text) {
  await expect(page.getByRole("main").getByText(text, { exact: false }).first()).toBeVisible();
}

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 960 }],
  ["phone", { width: 390, height: 844 }],
]) {
  test(`motion states — ${label}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    await stubSupabase(page);
    await signIn(page, baseURL);

    // ---- 1. A customer added from the list -------------------------------
    // The dialog closes back over a grid of five cards. Which one is new?
    await page.goto(`${baseURL}/customers`);
    await onScreen(page, "Bloom & Co");
    await page.screenshot({ path: `${OUT}/${label}-01-customers.png` });

    await page.getByRole("button", { name: "Add a customer" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
    await dialog.getByLabel(/Phone number/).fill("09181234567");
    await page.screenshot({ path: `${OUT}/${label}-02-dialog.png` });
    await dialog.getByRole("button", { name: /Save|Add/ }).click();
    await expect(dialog).toHaveCount(0);
    await hold(page);
    await page.screenshot({ path: `${OUT}/${label}-03-landed-customer.png` });

    // ---- 2. An order marked done, then read back on the list -------------
    await page.goto(`${baseURL}/orders`);
    await onScreen(page, "#104");
    await page.screenshot({ path: `${OUT}/${label}-04-orders.png` });

    await page.getByRole("button", { name: "Open" }).first().click();
    await onScreen(page, "All orders");
    await page.screenshot({ path: `${OUT}/${label}-05-order-before.png` });

    await page.getByRole("button", { name: "Mark as done" }).click();
    const confirm = page.getByRole("dialog");
    if (await confirm.count()) {
      await page.screenshot({ path: `${OUT}/${label}-06-confirm.png` });
      await confirm.getByRole("button", { name: /^Yes|done|Mark/ }).first().click();
      await expect(confirm).toHaveCount(0);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${label}-07-order-after.png` });

    await page.getByRole("button", { name: "All orders" }).click();
    await onScreen(page, "#104");
    await hold(page);
    await page.screenshot({ path: `${OUT}/${label}-08-landed-order-row.png` });

    // ---- 3. A delivery advanced, then read back on the board -------------
    await page.goto(`${baseURL}/deliveries`);
    await onScreen(page, "#204");
    await page.screenshot({ path: `${OUT}/${label}-09-deliveries.png` });

    await page.getByRole("button", { name: /#2041/ }).click();
    await onScreen(page, "The deliveries board");
    await page.getByRole("button", { name: "It is ready to go" }).click();
    const manifest = page.getByRole("dialog");
    if (await manifest.count()) {
      await manifest.getByRole("button", { name: /^Yes|Save|Record|Confirm/ }).first().click();
      await expect(manifest).toHaveCount(0);
    }
    await page.waitForTimeout(400);
    // Back through the app, never a reload: a fresh page would drop the
    // in-memory change signal, which is the thing being looked at.
    await page.getByRole("button", { name: "The deliveries board" }).click();
    await onScreen(page, "#204");
    await hold(page);
    await page.screenshot({ path: `${OUT}/${label}-10-landed-delivery.png` });

    // ---- 4. The three-segment stock bar ----------------------------------
    await page.goto(`${baseURL}/products`);
    await onScreen(page, "Edit");
    await page.screenshot({ path: `${OUT}/${label}-11-products.png` });
    await page.getByRole("button", { name: "View" }).first().click();
    await onScreen(page, "All products");
    await page.screenshot({ path: `${OUT}/${label}-12-product-detail.png` });

    // ---- 5. The staff table ----------------------------------------------
    await page.goto(`${baseURL}/staff`);
    await onScreen(page, "Maria");
    await page.screenshot({ path: `${OUT}/${label}-13-staff.png` });
  });
}
