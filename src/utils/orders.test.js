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

  // A price corrected all the way down to nothing used to be read as "no total
  // was stored" and quietly replaced by the sum of the lines, so an order
  // written off in full still showed -- and printed -- the original amount due.
  it("honours a price corrected down to nothing", () => {
    const totals = orderTotals(order({ totalAmount: 0 }), []);
    expect(totals.total).toBe(0);
    expect(totals.net).toBe(0);
  });

  // The guard against fixing that by simply accepting every number >= 0:
  // Number(null) is 0 and is perfectly finite, so an order carrying no total at
  // all must still fall back to the lines rather than come out free.
  it.each([[null], [undefined], [""]])(
    "falls back to the lines when the stored total is %p",
    (missing) => {
      expect(orderTotals(order({ totalAmount: missing }), []).total).toBe(200);
    },
  );

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

/**
 * The dialog's preview of what the database stamps on a refund. The database
 * is the authority (private.stamp_refund_money, directWriteGuards.test.js);
 * these keep the preview saying the same thing.
 */
describe("how much of a refund is money handed back", () => {
  const paidFor = { totalAmount: 600, refundedAmount: 0, refundHistory: [] };

  it("is nothing on an order nobody has paid for", async () => {
    const { refundSplit } = await import("./orders");
    expect(refundSplit(paidFor, 150, 0, "cash")).toEqual({ handedBack: 0, offBalance: 150 });
  });

  it("is all of it on an order paid in full", async () => {
    const { refundSplit } = await import("./orders");
    expect(refundSplit(paidFor, 150, 600, "cash")).toEqual({ handedBack: 150, offBalance: 0 });
  });

  it("is only what was paid beyond what the order still comes to", async () => {
    const { refundSplit } = await import("./orders");
    expect(refundSplit(paidFor, 300, 450, "cash")).toEqual({ handedBack: 150, offBalance: 150 });
    // And an earlier hand-back is not handed back twice.
    const after = { totalAmount: 600, refundedAmount: 300, refundHistory: [{ amount: 300, handedBack: 150, offBalance: 150 }] };
    expect(refundSplit(after, 150, 450, "cash")).toEqual({ handedBack: 150, offBalance: 0 });
    expect(refundSplit(after, 300, 450, "cash")).toEqual({ handedBack: 300, offBalance: 0 });
  });

  it("is nothing when it is left on their account", async () => {
    const { refundSplit } = await import("./orders");
    expect(refundSplit(paidFor, 150, 600, "credit")).toEqual({ handedBack: 0, offBalance: 150 });
  });

  it("reads an entry from before the stamp as it described itself", async () => {
    const { handedBackOf, moneyHandedBack, refundWords } = await import("./orders");
    expect(handedBackOf({ amount: 100, method: "cash" })).toBe(100);
    expect(handedBackOf({ amount: 100, method: "credit" })).toBe(0);
    expect(handedBackOf({ amount: 100, method: "cash", handedBack: 0 })).toBe(0);
    expect(moneyHandedBack({ refundHistory: [{ amount: 100, method: "cash" }, { amount: 50, handedBack: 20 }] })).toBe(120);
    expect(refundWords({ amount: 100, method: "cash" })).toMatch(/100\.00 given back$/);
    expect(refundWords({ amount: 100, handedBack: 0 })).toMatch(/100\.00 off what they owe$/);
    expect(refundWords({ amount: 100, handedBack: 40 }, { sentence: true })).toMatch(/40\.00 was given back and .*60\.00 came off what was owed$/);
  });
});

describe("short deliveries, call-off rules and what a run carried", () => {
  const twoLines = (first, second) => order({
    items: [line({ productId: 101, committedUnits: first }), line({ productId: 102, committedUnits: second })],
  });

  it("calls an order a backorder when a whole line was left behind", async () => {
    const { backorderLines } = await import("./orders");
    const allOfOneNoneOfOther = twoLines(5, 0);
    expect(hasBackorder(allOfOneNoneOfOther)).toBe(true);
    expect(backorderLines(allOfOneNoneOfOther).map((l) => l.productId)).toEqual([102]);
    expect(backorderStatusOf(allOfOneNoneOfOther)).toBe(BACKORDER_STATUS.PARTIAL);
    expect(backorderDemand([allOfOneNoneOfOther]).get(102)).toBe(5);
    // Nothing gone yet is still just a waiting order.
    expect(hasBackorder(twoLines(0, 0))).toBe(false);
  });

  it("will not call an order off while a run is out or has delivered", async () => {
    const { callOffBlocker } = await import("./orders");
    const runs = (status) => [{ id: 9, orderId: 1, status }];
    expect(callOffBlocker(order({ id: 1 }), runs(DELIVERY_STAGE.READY))).toBeNull();
    expect(callOffBlocker(order({ id: 1 }), runs(DELIVERY_STAGE.ON_THE_WAY))).toMatch(/on the way/);
    expect(callOffBlocker(order({ id: 1 }), runs(DELIVERY_STAGE.ARRIVED))).toMatch(/delivered/);
    expect(callOffBlocker(order({ id: 1 }), [{ id: 9, orderId: 2, status: DELIVERY_STAGE.ON_THE_WAY }])).toBeNull();
  });

  it("reads what a run carried from the field dispatch writes", async () => {
    const { loadedLines, manifestQty, runCanComeBack } = await import("./deliveries");
    const run = {
      status: DELIVERY_STAGE.ON_THE_WAY,
      itemsManifest: [
        { name: "Sheets", orderedQty: 20, deliveredQty: 12, backorderQty: 8 },
        { name: "Balls", orderedQty: 5, deliveredQty: 0, backorderQty: 5 },
      ],
    };
    expect(manifestQty(run.itemsManifest[0])).toBe(12);
    expect(manifestQty({ quantity: 3 })).toBe(3);
    expect(loadedLines(run).map((l) => l.name)).toEqual(["Sheets"]);
    expect(runCanComeBack(run, { status: ORDER_STATUS.PENDING })).toBe(true);
    expect(runCanComeBack(run, { status: ORDER_STATUS.COMPLETED })).toBe(false);
    expect(runCanComeBack({ ...run, itemsManifest: [] }, { status: ORDER_STATUS.PENDING })).toBe(false);
  });
});
