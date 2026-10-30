/**
 * In-app notifications: the events, who may hear about each, and the words.
 *
 * THE ROLE LISTS ARE THE DATABASE'S, written twice: private.notification_events_for
 * in the 2026-11-01 migration decides who is sent what, and this decides what
 * the settings page offers. A person with no saved choice hears about every
 * event their role allows.
 */
export const NOTIFICATION_GROUPS = [
  ["Orders", [
    ["order_new", "A new order is taken", "By anyone else, from any screen"],
    ["order_cancelled", "An order is cancelled", "Stock it held goes back on the shelf"],
    ["payment_overdue", "A payment is overdue", "Past its 30 or 60 days from delivery"],
  ]],
  ["Stock", [
    ["stock_low", "A product runs low", "At or below its warning level"],
    ["material_low", "A raw material needs ordering", "At or below its reorder level"],
  ]],
  ["Production", [["batch_qc", "A batch is waiting for quality check", "Ready to count and finish"]]],
  ["Deliveries", [
    ["delivery_late", "A delivery is late", "Past the day promised"],
    ["delivery_arrived", "A delivery arrives", "Marked delivered by the driver"],
  ]],
  ["Accounts", [["account_blocked", "Someone cannot sign in", "Their account was suspended"]]],
];

const BY_ROLE = {
  Admin: ["order_new", "order_cancelled", "payment_overdue", "stock_low", "material_low", "batch_qc", "delivery_late", "delivery_arrived", "account_blocked"],
  Manager: ["order_new", "order_cancelled", "payment_overdue", "stock_low", "material_low", "batch_qc", "delivery_late", "delivery_arrived"],
  "Sales Staff": ["order_new", "order_cancelled", "payment_overdue", "stock_low", "delivery_late", "delivery_arrived"],
  "Production Staff": ["order_new", "order_cancelled", "stock_low", "material_low", "batch_qc"],
  "Delivery Staff": ["delivery_late", "delivery_arrived"],
};

/** The events a role may hear about. */
export const eventsFor = (role) => BY_ROLE[role] ?? [];

/** How often the app asks the database to raise the clock-driven alerts. */
export const ALERT_REFRESH_MS = 5 * 60 * 1000;
