import { describe, expect, it } from "vitest";

import { BACKORDER_STATUS, DELIVERY_STAGE, ORDER_STATUS } from "./constants";
import {
  ORDER_STAGES,
  PARTLY_DELIVERED,
  backorderDemand,
  backorderStatusOf,
  deliveryForOrder,
  hasBackorder,
  orderCounts,
  orderNetTotal,
  orderProgress,
  orderTotals,
} from "./orders";

/**
 * The derivations the order screens read.
 *
 * The stage tracker and the chips are computed rather than stored, which is the
 * decision this file's header defends — so these tests are the place that
 * decision is checked. In particular: adding "Partly delivered" must not have
 * moved any of the four stage indexes, because everything that compares
 * progress between orders reads them.
 */

const line = (overrides) => ({
  productId: 101,
  name: "Styro Ball 6in",
  quantity: 5,
  unitPrice: 40,
  stockUnits: 5,
  ...overrides,
});

const order = (overrides = {}) => ({
  id: 12,
  status: ORDER_STATUS.PENDING,
  customerName: "Ana Reyes",
  createdAt: "2026-09-01T02:00:00.000Z",
  totalAmount: 200,
  stockCommittedAt: null,
  items: [line()],
  ...overrides,
});

/** 3 of the 5 have gone out; 2 are still owed. */
const partlySent = (overrides = {}) =>
  order({ items: [line({ committedUnits: 3 })], ...overrides });

describe("is anything still owed", () => {
  it("is not a backorder while nothing has left yet", () => {
    // Otherwise every open order would sit under the amber chip and the chip
    // would be worth nothing.
    expect(hasBackorder(order())).toBe(false);
  });

  it("is a backorder once part of it has gone and part has not", () => {
    expect(hasBackorder(partlySent())).toBe(true);
  });

  it("is not a backorder once the whole line has gone", () => {
    expect(hasBackorder(order({ items: [line({ committedUnits: 5 })] }))).toBe(false);
  });

  it("is not a backorder on an order that is no longer waiting", () => {
    expect(hasBackorder(partlySent({ status: ORDER_STATUS.CANCELLED }))).toBe(false);
  });

  it("counts what is owed per product for the make list", () => {
    expect(backorderDemand([partlySent(), order()]).get(101)).toBe(2);
  });

  it("writes the cache column to match", () => {
    expect(backorderStatusOf(order())).toBe(BACKORDER_STATUS.NONE);
    expect(backorderStatusOf(partlySent())).toBe(BACKORDER_STATUS.PARTIAL);
    expect(
      backorderStatusOf(
        order({ status: ORDER_STATUS.COMPLETED, items: [line({ committedUnits: 5 })] })
      )
    ).toBe(BACKORDER_STATUS.RESOLVED);
  });
});

describe("the stage tracker", () => {
  it("still has exactly four stages, at the same indexes", () => {
    expect(ORDER_STAGES).toEqual(["Written", "Being made", "Ready to go", "Delivered"]);
    expect(orderProgress(order()).stages).toHaveLength(4);
    expect(orderProgress(partlySent()).stages).toHaveLength(4);
  });

  it("stands in the last stage rather than past it when part is still owed", () => {
    const progress = orderProgress(partlySent());
    expect(progress.partial).toBe(true);
    expect(progress.current).toBe(3);
    expect(progress.stages[3].label).toBe(PARTLY_DELIVERED);
  });

  it("finishes all four when the order is done", () => {
    const progress = orderProgress(order({ status: ORDER_STATUS.COMPLETED }));
    expect(progress.current).toBe(4);
    expect(progress.stages[3].label).toBe("Delivered");
  });

  it("draws no tracker for a cancelled order", () => {
    const progress = orderProgress(order({ status: ORDER_STATUS.CANCELLED }));
    expect(progress.cancelled).toBe(true);
    expect(progress.stages).toEqual([]);
  });
});

describe("which delivery an order is showing", () => {
  const original = {
    id: 13,
    product: "Order #12 - Ana Reyes",
    status: DELIVERY_STAGE.ARRIVED,
    amount: 150,
  };
  const followUp = {
    id: 14,
    product: "Order #12 - Ana Reyes (backorder)",
    parentDeliveryId: 13,
    status: DELIVERY_STAGE.NOT_SENT,
    amount: 0,
  };

  it("follows the run that has not arrived yet", () => {
    // Showing the finished run would report the order as delivered while the
    // customer is still waiting for half of it.
    expect(deliveryForOrder(order(), [original, followUp]).id).toBe(14);
  });

  it("falls back to the most recent once they have all arrived", () => {
    const done = { ...followUp, status: DELIVERY_STAGE.ARRIVED };
    expect(deliveryForOrder(order(), [original, done]).id).toBe(14);
  });

  it("does not confuse order #1 with order #12", () => {
    expect(deliveryForOrder({ id: 1 }, [original, followUp])).toBeUndefined();
  });

  it("charges the delivery once, not once per run", () => {
    const totals = orderTotals(order({ totalAmount: 0 }), [
      original,
      { ...followUp, amount: 150 },
    ]);
    expect(totals.delivery).toBe(150);
  });
});

describe("money on an order", () => {
  it("nets off what has been given back", () => {
    expect(orderNetTotal(order({ refundedAmount: 50 }))).toBe(150);
  });

  it("never goes below nothing", () => {
    expect(orderNetTotal(order({ refundedAmount: 500 }))).toBe(0);
  });

  it("reports both figures to the footer", () => {
    const totals = orderTotals(order({ refundedAmount: 50 }), []);
    expect(totals.total).toBe(200);
    expect(totals.refunded).toBe(50);
    expect(totals.net).toBe(150);
  });

  it("counts the chips from the unfiltered set", () => {
    const counts = orderCounts([
      order(),
      partlySent(),
      order({ id: 14, refundedAmount: 25 }),
      order({ id: 15, status: ORDER_STATUS.CANCELLED }),
    ]);
    expect(counts.all).toBe(4);
    expect(counts.waiting).toBe(3);
    expect(counts.backorder).toBe(1);
    expect(counts.refunded).toBe(1);
    expect(counts.cancelled).toBe(1);
  });
});
