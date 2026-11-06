/**
 * Money received against orders, and what is still owed.
 *
 * WHAT IS OWED is the order's net total -- its total less anything refunded
 * (orderNetTotal) -- less what has been paid. The database works it out the
 * same way when it records a payment (public.record_payment), and refuses an
 * amount larger than this, so the screens and the database never disagree
 * about a balance.
 */
import { ORDER_STATUS } from "./constants";
import { localDateIso } from "./dates";
import { roundMoney } from "./money";
import { orderNetTotal } from "./orders";

/** The ways a customer pays, in the order the design lists them. */
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank", label: "Bank transfer" },
  { value: "check", label: "Check" },
];

export const paymentMethodLabel = (value) =>
  PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value;

/** Cash needs no reference; anything else is traced by the number on its receipt. */
export const needsReference = (method) => method !== "cash";

/**
 * Delivered orders are paid on terms, counted from the day they are delivered;
 * an order picked up at the shop has no term (null) and is paid there.
 */
export const TERM_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
];

export const termLabel = (days) => (days ? `${days} days from delivery` : "Paid at pick-up");

/**
 * The yyyy-mm-dd day payment falls due, or null: an order is due `term` days
 * after it was delivered (stamped as stock_committed_at when it is marked
 * done), and has no due day until then or when it is not on terms.
 */
export function dueDateOf(order) {
  if (!order?.paymentTermDays || !order.stockCommittedAt) return null;
  const due = new Date(order.stockCommittedAt);
  due.setUTCDate(due.getUTCDate() + Number(order.paymentTermDays));
  return localDateIso(due);
}

/** Whole days from `today` until `day` (negative once it has passed). */
export function daysUntil(day, today) {
  if (!day || !today) return null;
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** orderId -> amount paid, from the order_paid rows. */
export const paidIndex = (rows = []) => new Map(rows.map((row) => [row.orderId, row.paid]));

/** What has been paid on this order. */
export const paidOn = (order, paid) => roundMoney(paid?.get(order?.id) ?? 0);

/** What is still owed on this order. Nothing on a cancelled one. */
export function balanceOf(order, paid) {
  if (!order || order.status === ORDER_STATUS.CANCELLED) return 0;
  return Math.max(0, roundMoney(orderNetTotal(order) - paidOn(order, paid)));
}

/** The orders that still owe something, oldest first -- the order a payment settles them in. */
export function owingOrders(orders = [], paid) {
  return orders
    .filter((order) => balanceOf(order, paid) > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
}

/**
 * The problem with a payment as typed, or null. `owed` is the most it may be.
 * The database checks each of these again.
 */
export function paymentProblem({ amount, method, reference, receivedOn }, owed, today) {
  const value = Number(amount);
  if (amount === "" || amount == null || !Number.isFinite(value) || value <= 0) return { field: "amount", message: "Put in the amount received." };
  if (roundMoney(value) !== value) return { field: "amount", message: "Use at most two decimal places." };
  if (value > owed) return { field: "amount", message: `That is more than is owed. Put in at most ${owed.toFixed(2)}.` };
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return { field: "method", message: "Choose how it was paid." };
  if (needsReference(method) && !String(reference ?? "").trim()) {
    return { field: "reference", message: method === "check" ? "Put in the check number." : "Put in the reference number from the receipt." };
  }
  if (String(reference ?? "").trim().length > 80) return { field: "reference", message: "Keep the reference to 80 characters." };
  if (!receivedOn) return { field: "receivedOn", message: "Choose the day it was received." };
  if (today && receivedOn > today) return { field: "receivedOn", message: "The payment cannot be dated after today." };
  return null;
}
