import { describe, expect, it } from "vitest";

import { ORDER_STATUS } from "./constants";
import { customerSummary, ordersByCustomer } from "./customers";

/**
 * Which orders belong to which customer.
 *
 * WHY THIS IS WORTH TESTING. Orders used to find their customer by name alone,
 * so correcting a spelling on a customer card silently detached their whole
 * history -- the orders were all still there, and the person they belonged to
 * could no longer be told. orders.customer_id now carries the link.
 *
 * The name path stays, because the order form takes the customer as free text
 * on purpose and a walk-in is not a customer record. So the steady state is a
 * MIXTURE: newer orders linked by id, older ones findable only by name. Every
 * case below is about that mixture, because that is where a plausible-looking
 * implementation quietly returns the wrong number.
 */

const customer = (overrides = {}) => ({
  id: 7,
  name: "Ana Reyes",
  kind: "person",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const order = (overrides = {}) => ({
  id: 100,
  customerName: "Ana Reyes",
  customerId: null,
  status: ORDER_STATUS.COMPLETED,
  totalAmount: 100,
  createdAt: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

const summarise = (who, orders) => customerSummary(who, ordersByCustomer(orders));

describe("finding a customer's orders", () => {
  it("keeps a linked order after the customer is renamed", () => {
    const renamed = customer({ name: "Ana Reyes-Cruz" });
    const summary = summarise(renamed, [order({ customerId: 7, customerName: "Ana Reyes" })]);
    expect(summary.orderCount).toBe(1);
    expect(summary.spent).toBe(100);
  });

  it("still finds an unlinked order by name", () => {
    const summary = summarise(customer(), [order({ customerId: null })]);
    expect(summary.orderCount).toBe(1);
  });

  // The one a fallback rather than a merge gets wrong: taking the id list and
  // stopping would report 1 here, undercounting the customer's real history.
  it("counts linked and unlinked orders together", () => {
    const summary = summarise(customer(), [
      order({ id: 100, customerId: 7 }),
      order({ id: 101, customerId: null, customerName: "Ana Reyes" }),
    ]);
    expect(summary.orderCount).toBe(2);
    expect(summary.spent).toBe(200);
  });

  // And the one a naive merge gets wrong, by counting the same order twice.
  it("counts an order once even when its name matches too", () => {
    const summary = summarise(customer(), [order({ id: 100, customerId: 7, customerName: "Ana Reyes" })]);
    expect(summary.orderCount).toBe(1);
    expect(summary.spent).toBe(100);
  });

  // Two real people who share a name. Their linked orders must not leak into
  // each other -- this is the half of the bug that predates any rename.
  it("keeps two same-named customers' linked orders apart", () => {
    const first = customer({ id: 7 });
    const second = customer({ id: 8 });
    const orders = [
      order({ id: 100, customerId: 7, totalAmount: 100 }),
      order({ id: 101, customerId: 8, totalAmount: 250 }),
    ];
    expect(summarise(first, orders).orderCount).toBe(1);
    expect(summarise(first, orders).spent).toBe(100);
    expect(summarise(second, orders).spent).toBe(250);
  });

  it("reports a waiting order through either thread", () => {
    expect(summarise(customer(), [order({ customerId: 7, status: ORDER_STATUS.PENDING })]).hasOpenOrder).toBe(true);
    expect(summarise(customer(), [order({ customerId: null, status: ORDER_STATUS.PENDING })]).hasOpenOrder).toBe(true);
  });

  it("leaves a cancelled order out of what they have spent", () => {
    const summary = summarise(customer(), [
      order({ id: 100, customerId: 7, totalAmount: 100 }),
      order({ id: 101, customerId: 7, totalAmount: 900, status: ORDER_STATUS.CANCELLED }),
    ]);
    expect(summary.orderCount).toBe(2);
    expect(summary.spent).toBe(100);
  });

  it("does not gather every nameless order under one key", () => {
    const summary = summarise(customer({ name: "" }), [
      order({ id: 100, customerId: null, customerName: "" }),
    ]);
    expect(summary.orderCount).toBe(0);
  });
});
