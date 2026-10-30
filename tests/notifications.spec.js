/**
 * In-app notifications: the bell in the top bar, and each person choosing
 * what they hear about. The stub stands in for the database's triggers by
 * holding alerts that are already there.
 */
import { test, expect } from "@playwright/test";
import { signIn, stubSupabase } from "./stubSupabase.js";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

test("the bell counts unread alerts, and one opens what it is about", async ({ page, baseURL }) => {
  const writes = [];
  const tables = await stubSupabase(page, { onWrite: (w) => writes.push(w) });
  tables.notifications.push(
    { id: 9501, staff_id: 1, event: "payment_overdue", title: "Order #1041 is overdue", body: "Reyes Events owes ₱6,280.00", view: "order-detail", record_id: 1041, dedupe_key: "a", created_at: ago(5), read_at: null },
    { id: 9502, staff_id: 1, event: "stock_low", title: "Styro Ball 4 inch is running low", body: "8 left", view: "products", record_id: null, dedupe_key: "b", created_at: ago(30), read_at: null },
  );
  await signIn(page, baseURL);

  const bell = page.getByRole("button", { name: "Notifications, 2 unread" });
  await expect(bell).toBeVisible();
  await bell.click();
  await page.getByRole("button", { name: /Order #1041 is overdue/ }).click();

  await expect(page).toHaveURL(/\/orders\/1041$/);
  expect(writes.some((w) => w.table === "notifications" && w.row?.ids?.includes(9501))).toBe(true);
  await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();

  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});

test("each person chooses their own alerts, from what their role works with", async ({ page, baseURL }) => {
  const writes = [];
  await stubSupabase(page, { as: "juan@lsbhandicrafts.test", onWrite: (w) => writes.push(w) });
  await signIn(page, baseURL, "juan@lsbhandicrafts.test");
  // Open to every role now, not only administrators.
  await page.goto(`${baseURL}/settings-notifications`);
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();

  // Sales never see account alerts or production's.
  await expect(page.getByText("Someone cannot sign in")).toHaveCount(0);
  await expect(page.getByText("A batch is waiting for quality check")).toHaveCount(0);

  // Never saved: everything their role allows starts ticked.
  const overdue = page.getByRole("checkbox", { name: "A payment is overdue: In the app" });
  await expect(overdue).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "A payment is overdue: Email" })).toBeDisabled();

  await page.getByRole("checkbox", { name: "A new order is taken: In the app" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your notification settings were saved.")).toBeVisible();
  const saved = writes.find((w) => w.table === "notification_settings")?.row.in_app;
  expect(saved).toContain("payment_overdue");
  expect(saved).not.toContain("order_new");
});
