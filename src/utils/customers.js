/**
 * Customers, as the sales screens need them.
 *
 * The customers screen is CARDS rather than a table, because a person is a
 * face, a phone number and a place — and sales staff use it standing at a
 * counter with somebody in front of them, where a dense row of columns is the
 * wrong shape entirely.
 *
 * Its chips are the interesting part. Most list filters are categories; these
 * are questions somebody actually asks:
 *
 *   Regulars                  who should we look after
 *   Has an open order         who is waiting on us right now
 *   New this month            who have we just won
 *   Not ordered in a year     WHO SHOULD WE RING
 *
 * That last one is a call list, not a filter, and it is the reason this file
 * joins customers to orders at all.
 */

import { ORDER_STATUS } from "./constants";

const REGULAR_AT = 3;
const A_YEAR = 365 * 86400000;

const timeOf = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
};

/**
 * customer name (lowercased) -> their orders.
 *
 * Matched on NAME, not on an id, because `orders` stores `customer_name` as
 * free text and has no customer_id. That is a real weakness — two customers
 * with the same name are indistinguishable here, and a renamed customer loses
 * their history — and it is worth stating rather than hiding: fixing it means
 * a foreign key and a migration of existing rows, which is a bigger change
 * than a visual overhaul should be making on its own.
 */
export function ordersByCustomer(orders = []) {
  const index = new Map();
  for (const order of orders) {
    const key = String(order.customerName || "").trim().toLowerCase();
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(order);
  }
  return index;
}

/** Everything the card and the chips need about one customer. */
export function customerSummary(customer, index) {
  const orders = index.get(String(customer.name || "").trim().toLowerCase()) ?? [];
  const spent = orders
    .filter((order) => order.status !== ORDER_STATUS.CANCELLED)
    .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

  const times = orders.map((order) => timeOf(order.createdAt)).filter((t) => t !== null);
  const lastOrderAt = times.length > 0 ? Math.max(...times) : null;
  const createdAt = timeOf(customer.createdAt);
  const now = Date.now();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return {
    orderCount: orders.length,
    spent,
    lastOrderAt,
    isBusiness: customer.kind === "business",
    isRegular: orders.length >= REGULAR_AT,
    hasOpenOrder: orders.some((order) => order.status === ORDER_STATUS.PENDING),
    isNewThisMonth: createdAt !== null && createdAt >= startOfMonth.getTime(),
    // Somebody who has never ordered but has been on the books over a year
    // counts too: they are exactly who a call list is for.
    isLapsed:
      lastOrderAt !== null
        ? now - lastOrderAt > A_YEAR
        : createdAt !== null && now - createdAt > A_YEAR,
  };
}

/** The chip row, with counts from the unfiltered set. */
export function customerChips(rows) {
  const count = (test) => rows.filter(({ summary }) => test(summary)).length;
  return [
    { value: "all", label: "Everyone", count: rows.length },
    { value: "business", label: "Businesses", count: count((s) => s.isBusiness) },
    { value: "walk-in", label: "Walk-ins", count: count((s) => !s.isBusiness) },
    { value: "regular", label: "Regulars", count: count((s) => s.isRegular), tone: "green" },
    {
      value: "open",
      label: "Has an open order",
      count: count((s) => s.hasOpenOrder),
      tone: "amber",
    },
    { value: "new", label: "New this month", count: count((s) => s.isNewThisMonth) },
    {
      value: "lapsed",
      label: "Not ordered in a year",
      count: count((s) => s.isLapsed),
      tone: "clay",
    },
  ];
}

const CHIP_TESTS = {
  all: () => true,
  business: (s) => s.isBusiness,
  "walk-in": (s) => !s.isBusiness,
  regular: (s) => s.isRegular,
  open: (s) => s.hasOpenOrder,
  new: (s) => s.isNewThisMonth,
  lapsed: (s) => s.isLapsed,
};

export const matchesCustomerChip = (summary, chip) =>
  (CHIP_TESTS[chip] ?? CHIP_TESTS.all)(summary);

/**
 * The city or district from an address — the last comma-separated part, which
 * is how these are written ("12 Mabini St, Poblacion, Davao City").
 */
export function cityOf(customer) {
  const parts = String(customer?.address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/** The distinct places customers are, for the Area filter. */
export function citiesOf(customers = []) {
  const seen = new Map();
  for (const customer of customers) {
    const city = cityOf(customer);
    if (city && !seen.has(city.toLowerCase())) seen.set(city.toLowerCase(), city);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
