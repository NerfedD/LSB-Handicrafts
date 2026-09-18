/**
 * The two paths that are easy to write and never look at: the dark theme, and
 * a machine that has been asked for less motion.
 *
 * Reduced motion here is not "does nothing happen" — it is "does the person
 * still get told their entry went in". The landing wash is colour, not travel,
 * so it is supposed to survive.
 */
import { test, expect } from "@playwright/test";
import { stubSupabase, signIn } from "./stubSupabase.js";

const OUT = "test-results/motion";

async function hold(page) {
  await page.addStyleTag({
    content: `.lsb-landed, .lsb-landed-row {
      animation-play-state: paused !important; animation-delay: -300ms !important; }`,
  });
}

async function addCustomer(page, baseURL) {
  await page.goto(`${baseURL}/customers`);
  await expect(page.getByRole("main").getByText("Bloom & Co").first()).toBeVisible();
  await page.getByRole("button", { name: "Add a customer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Their name/).fill("Aling Nena Catering");
  await dialog.getByLabel(/Phone number/).fill("09181234567");
  await dialog.getByRole("button", { name: /Save|Add/ }).click();
  await expect(dialog).toHaveCount(0);
}

test("dark theme — the landing wash flips with the palette", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ colorScheme: "dark" });
  await stubSupabase(page);
  await signIn(page, baseURL);
  await addCustomer(page, baseURL);
  await hold(page);
  await page.screenshot({ path: `${OUT}/dark-landed-customer.png` });

  await page.goto(`${baseURL}/orders`);
  await expect(page.getByRole("main").getByText("#104").first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByRole("main").getByText("All orders").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/dark-stage-tracker.png` });
});

test("reduced motion — the confirmation survives, the travel does not", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubSupabase(page);
  await signIn(page, baseURL);
  await addCustomer(page, baseURL);
  await hold(page);
  await page.screenshot({ path: `${OUT}/reduced-landed-customer.png` });

  // The wash is colour, so it is still painted. Asserted rather than eyeballed:
  // a future edit to the reduced-motion block that takes it out should fail
  // here rather than quietly leave somebody with no confirmation at all.
  const wash = page.locator(".lsb-landed").first();
  await expect(wash).toHaveCount(1);
  const name = await wash.evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("lsb-land");

  // The screen arrival, by contrast, is travel, and reduces to a plain fade.
  const rise = page.locator(".lsb-rise").first();
  const riseName = await rise.evaluate((el) => getComputedStyle(el).animationName);
  expect(riseName).toBe("lsb-fade");
});
