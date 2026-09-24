import { describe, expect, it } from 'vitest';

import { customerChips, customerSummary, DEFAULT_LOYALTY, loyaltyDiscount, statsIndex, totalsFor } from './customers';

/**
 * Whose orders are whose, and who counts as a regular.
 *
 * The database sums a customer's history (public.customer_order_stats) in two
 * rows: orders linked to the record by id, and orders written under the name
 * that carry no id -- a walk-in served before being enrolled, or an order older
 * than the link. These cases are about combining those two rows, because that
 * is where a plausible-looking implementation quietly returns the wrong number.
 * How the rows themselves are counted is tested against the real view in
 * permissionsDatabase.test.js.
 */

const customer = (overrides = {}) => ({
  id: 7,
  name: 'Ana Reyes',
  kind: 'walk-in',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const row = (key, overrides = {}) => ({
  key,
  orderCount: 1,
  completedCount: 1,
  openCount: 0,
  spent: 100,
  lastOrderAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

describe("a customer's totals", () => {
  it('adds the linked row and the name-matched row together', () => {
    const index = statsIndex([row('id:7'), row('name:ana reyes', { spent: 250, lastOrderAt: '2026-06-01T00:00:00.000Z' })]);
    expect(totalsFor(customer(), index)).toEqual({
      orderCount: 2, completedCount: 2, openCount: 0, spent: 350, lastOrderAt: Date.parse('2026-06-01T00:00:00.000Z'),
    });
  });

  it('keeps a linked history after the customer is renamed', () => {
    const index = statsIndex([row('id:7')]);
    expect(totalsFor(customer({ name: 'Ana Reyes-Cruz' }), index).orderCount).toBe(1);
  });

  it('matches a name however it was capitalised or spaced on the customer card', () => {
    const index = statsIndex([row('name:ana reyes')]);
    expect(totalsFor(customer({ id: 99, name: '  ANA Reyes ' }), index).orderCount).toBe(1);
  });

  it("keeps two same-named customers' linked orders apart", () => {
    const index = statsIndex([row('id:7', { spent: 100 }), row('id:8', { spent: 250 })]);
    expect(totalsFor(customer({ id: 7 }), index).spent).toBe(100);
    expect(totalsFor(customer({ id: 8 }), index).spent).toBe(250);
  });

  it('does not gather every nameless order under a nameless customer', () => {
    const index = statsIndex([row('name:')]);
    expect(totalsFor(customer({ id: 99, name: '' }), index).orderCount).toBe(0);
  });
});

describe('regulars and the loyalty reward', () => {
  const rules = { ...DEFAULT_LOYALTY, enabled: true, regularAfterOrders: 3, rewardAfterOrders: 5 };

  it('makes somebody a regular on finished orders, not on orders still waiting', () => {
    const index = statsIndex([row('id:7', { orderCount: 5, completedCount: 2, openCount: 3 })]);
    const summary = customerSummary(customer(), index, rules);
    expect(summary.isRegular).toBe(false);
    expect(summary.hasOpenOrder).toBe(true);
  });

  it('offers the reward only when it is switched on and has been earned', () => {
    const index = statsIndex([row('id:7', { completedCount: 5 })]);
    expect(customerSummary(customer(), index, rules).rewardEligible).toBe(true);
    expect(customerSummary(customer(), index, { ...rules, enabled: false }).rewardEligible).toBe(false);
    expect(customerSummary(customer(), index, { ...rules, rewardAfterOrders: 6 }).rewardEligible).toBe(false);
  });

  it('shows the reward chip only while the reward is switched on', () => {
    const rows = [{ customer: customer(), summary: customerSummary(customer(), statsIndex([]), rules) }];
    expect(customerChips(rows, rules).map((chip) => chip.value)).toContain('reward');
    expect(customerChips(rows, DEFAULT_LOYALTY).map((chip) => chip.value)).not.toContain('reward');
  });

  it('never rounds the discount above what the database allows', () => {
    expect(loyaltyDiscount(1000, { rewardPercent: 10 })).toBe(100);
    expect(loyaltyDiscount(999.99, { rewardPercent: 5 })).toBe(49.99);
    expect(loyaltyDiscount(-5, { rewardPercent: 5 })).toBe(0);
  });
});
