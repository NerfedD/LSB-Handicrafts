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

/** The two ways an order can be found, kept apart so they cannot collide. */
const idKey = (id) => `id:${id}`;
const nameKey = (name) => `name:${String(name || "").trim().toLowerCase()}`;

/**
 * A key -> their orders, keyed by customer id where there is one and by name
 * where there is not.
 *
 * ORDERS USED TO BE MATCHED ON NAME ALONE, because `orders` stored customer_name
 * as free text and nothing else. Correcting a spelling on a customer card
 * therefore lost their whole history at once, and two customers who share a name
 * shared a history. `orders.customer_id` now carries the link.
 *
 * THE NAME PATH DOES NOT GO AWAY, and is not a leftover. The order form takes
 * the customer as free text on purpose so a walk-in can be served without being
 * enrolled first, so an order may name somebody who is no customer record at
 * all. Those rows have no id to be found by and are found the way they always
 * were. What changed is that the name is no longer the ONLY thread.
 */
export function ordersByCustomer(orders = []) {
  const index = new Map();
  for (const order of orders) {
    const key = order.customerId != null ? idKey(order.customerId) : nameKey(order.customerName);
    if (key === nameKey("")) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(order);
  }
  return index;
}

/**
 * One customer's orders, down both threads.
 *
 * MERGED, NOT FALLEN BACK TO. The ordinary state of a customer from here on is
 * some orders linked by id and older ones still only findable by name -- so
 * taking the id list and stopping would undercount exactly the long-standing
 * customers whose history matters most. Ids first, then any name-matched order
 * not already counted.
 *
 * EXPORTED so there is one answer to "which orders are theirs". The detail
 * screen used to reach into the index with a bare name key of its own, which is
 * how it came to disagree with the summary printed beside it the moment orders
 * started carrying ids.
 */
export function ordersFor(customer, index) {
  const byId = index.get(idKey(customer?.id)) ?? [];
  const byName = index.get(nameKey(customer?.name)) ?? [];
  if (byName.length === 0) return byId;
  const seen = new Set(byId.map((order) => order.id));
  return [...byId, ...byName.filter((order) => !seen.has(order.id))];
}

/** Everything the card and the chips need about one customer. */
export function customerSummary(customer, index) {
  const orders = ordersFor(customer, index);
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
