/**
 * Customers, as the sales screens need them.
 *
 * The chips on the customers screen are questions somebody actually asks:
 *
 *   Regulars                  who should we look after
 *   Loyalty reward            who gets the reward on their next order
 *   Has an open order         who is waiting on us right now
 *   New this month            who have we just won
 *   Not ordered in a year     WHO SHOULD WE RING
 *
 * The totals behind them cover a customer's WHOLE history, which the browser
 * does not load: public.customer_order_stats sums it in the database, one row
 * per customer id and one per name for orders that carry no id.
 */

const A_YEAR = 365 * 86400000;

/**
 * Loyalty rules as they stand before a manager changes them. The reward is off
 * until somebody switches it on; "Regular" works either way.
 */
export const DEFAULT_LOYALTY = {
  enabled: false,
  regularAfterOrders: 3,
  rewardAfterOrders: 5,
  rewardPercent: 5,
};

const timeOf = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
};

const idKey = (id) => `id:${id}`;
const nameKey = (name) => {
  const key = String(name || '').trim().toLowerCase();
  return key ? `name:${key}` : null;
};

/** customer_order_stats rows, by key. Build once per render. */
export const statsIndex = (rows = []) => new Map(rows.map((row) => [row.key, row]));

/**
 * A customer's totals down both threads: orders linked to their record by id,
 * plus orders written under their name that carry no id -- a walk-in served
 * before being enrolled, or an order older than the link. Each order is in
 * exactly one of the two rows, so adding them never counts one twice.
 */
export function totalsFor(customer, index) {
  const parts = [index.get(idKey(customer?.id)), index.get(nameKey(customer?.name))].filter(Boolean);
  const sum = (field) => parts.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const times = parts.map((row) => timeOf(row.lastOrderAt)).filter((t) => t !== null);
  return {
    orderCount: sum('orderCount'),
    completedCount: sum('completedCount'),
    openCount: sum('openCount'),
    spent: sum('spent'),
    lastOrderAt: times.length > 0 ? Math.max(...times) : null,
  };
}

/** Everything the card and the chips need about one customer. */
export function customerSummary(customer, index, rules = DEFAULT_LOYALTY) {
  const totals = totalsFor(customer, index);
  const createdAt = timeOf(customer.createdAt);
  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return {
    ...totals,
    isBusiness: customer.kind === 'business',
    // Finished orders only: an order still waiting, or called off, has not made
    // anybody a regular.
    isRegular: totals.completedCount >= rules.regularAfterOrders,
    rewardEligible: isRewardEligible(customer, totals, rules),
    hasOpenOrder: totals.openCount > 0,
    isNewThisMonth: createdAt !== null && createdAt >= startOfMonth.getTime(),
    // Somebody on the books over a year who has never ordered counts too: they
    // are exactly who a call list is for.
    isLapsed:
      totals.lastOrderAt !== null
        ? now - totals.lastOrderAt > A_YEAR
        : createdAt !== null && now - createdAt > A_YEAR,
  };
}

/**
 * The same test the database applies when the reward is written onto an order
 * (private.validate_order_promotion): switched on, a saved customer, and
 * enough finished orders.
 */
function isRewardEligible(customer, totals, rules) {
  return Boolean(rules.enabled && customer?.id != null && totals.completedCount >= rules.rewardAfterOrders);
}

/**
 * The reward on an order whose items come to `itemsTotal`. Rounded DOWN to the
 * centavo, so it can never exceed the database's own rounding of the same rule.
 */
export function loyaltyDiscount(itemsTotal, rules) {
  return Math.floor(Math.max(0, Number(itemsTotal) || 0) * (Number(rules.rewardPercent) || 0)) / 100;
}

/** The chip row, with counts from the unfiltered set. */
export function customerChips(rows, rules = DEFAULT_LOYALTY) {
  const count = (test) => rows.filter(({ summary }) => test(summary)).length;
  return [
    { value: 'all', label: 'Everyone', count: rows.length },
    { value: 'business', label: 'Businesses', count: count((s) => s.isBusiness) },
    { value: 'walk-in', label: 'Walk-ins', count: count((s) => !s.isBusiness) },
    { value: 'regular', label: 'Regulars', count: count((s) => s.isRegular), tone: 'green' },
    ...(rules.enabled
      ? [{ value: 'reward', label: 'Loyalty reward', count: count((s) => s.rewardEligible), tone: 'green' }]
      : []),
    { value: 'open', label: 'Has an open order', count: count((s) => s.hasOpenOrder), tone: 'amber' },
    { value: 'new', label: 'New this month', count: count((s) => s.isNewThisMonth) },
    { value: 'lapsed', label: 'Not ordered in a year', count: count((s) => s.isLapsed), tone: 'clay' },
  ];
}

const CHIP_TESTS = {
  all: () => true,
  business: (s) => s.isBusiness,
  'walk-in': (s) => !s.isBusiness,
  regular: (s) => s.isRegular,
  reward: (s) => s.rewardEligible,
  open: (s) => s.hasOpenOrder,
  new: (s) => s.isNewThisMonth,
  lapsed: (s) => s.isLapsed,
};

export const matchesCustomerChip = (summary, chip) => (CHIP_TESTS[chip] ?? CHIP_TESTS.all)(summary);

/**
 * The city or district from an address -- the last comma-separated part, which
 * is how these are written ("12 Mabini St, Poblacion, Davao City").
 */
export function cityOf(customer) {
  const parts = String(customer?.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
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
