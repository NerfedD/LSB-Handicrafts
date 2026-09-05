import { describe, expect, it } from "vitest";

import { ORDER_STATUS, REFUND_DISPOSITION } from "./constants";
import {
  applyReservations,
  commitOrder,
  commitPartialDelivery,
  handleRefundStock,
  reservedByProduct,
  uncommitOrder,
} from "./stockLedger";

/**
 * The stock ledger, where the money-shaped mistakes live.
 *
 * WHAT IS WORTH TESTING HERE, and it is not "does it subtract". These functions
 * are the only place in the app where a number can be wrong in a way nobody
 * notices for a month: a shelf reporting stock that has already gone, or a
 * broken sheet counted as sellable. Every case below is one of those, written
 * as the situation that produces it rather than as a function call.
 *
 * The screens are proved end to end by Playwright against a stubbed Supabase.
 * These are the combinations of numbers that would be slower to click through
 * and would prove less: a manifest submitted twice, a scrapped return against a
 * restocked one, an order stamped before the per-line counters existed.
 */

const shelf = (stock = 20) => [
  { id: 101, name: "Styro Ball 6in", sku: "SB6", stock, reserved: 0, lowStockThreshold: 10 },
  { id: 102, name: "Styro Sheet 1in", sku: "SS1", stock, reserved: 0, lowStockThreshold: 10 },
];

/** One pending order: 5 balls and 3 sheets, nothing sent yet. */
const order = (overrides = {}) => ({
  id: 900,
  status: ORDER_STATUS.PENDING,
  customerName: "Ana Reyes",
  stockCommittedAt: null,
  ...overrides,
  items: overrides.items ?? [
    { productId: 101, name: "Styro Ball 6in", quantity: 5, unitPrice: 40, stockUnits: 5 },
    { productId: 102, name: "Styro Sheet 1in", quantity: 3, unitPrice: 120, stockUnits: 3 },
  ],
});

const stockOf = (inventory, id) => inventory.find((row) => row.id === id).stock;

describe("what is still owed", () => {
  it("counts the whole order while none of it has gone", () => {
    const totals = reservedByProduct([order()]);
    expect(totals.get(101)).toBe(5);
    expect(totals.get(102)).toBe(3);
  });

  it("counts nothing for an order that is not waiting", () => {
    expect(reservedByProduct([order({ status: ORDER_STATUS.COMPLETED })]).size).toBe(0);
    expect(reservedByProduct([order({ status: ORDER_STATUS.CANCELLED })]).size).toBe(0);
  });

  it("reads an order written before the counters existed exactly as before", () => {
    // No committedUnits, no voidedUnits, not even a stockUnits on the line —
    // the shape orders were saved in before any of this work.
    const legacy = {
      id: 1,
      status: ORDER_STATUS.PENDING,
      items: [{ productId: 101, name: "Styro Ball 6in", price: 40, quantity: 4 }],
    };
    expect(reservedByProduct([legacy]).get(101)).toBe(4);
  });
});

describe("a delivery that could not take everything", () => {
  it("deducts only what physically went, and keeps the rest set aside", () => {
    const before = shelf();
    const source = order();

    const { inventory, items } = commitPartialDelivery(before, source, [
      { lineIndex: 0, units: 3 },
      { lineIndex: 1, units: 3 },
    ]);

    // Three balls left the building, not five.
    expect(stockOf(inventory, 101)).toBe(17);
    expect(stockOf(inventory, 102)).toBe(17);

    // The two balls left behind are still promised to this customer, so they
    // are still reserved and still not sellable to anybody else.
    const owed = reservedByProduct([{ ...source, items }]);
    expect(owed.get(101)).toBe(2);
    expect(owed.get(102)).toBeUndefined();
  });

  it("does not stamp the order while anything is still owed", () => {
    const { stockCommittedAt } = commitPartialDelivery(shelf(), order(), [
      { lineIndex: 0, units: 3 },
      { lineIndex: 1, units: 3 },
    ]);
    expect(stockCommittedAt).toBeNull();
  });

  it("stamps the order once the last of it goes", () => {
    const first = commitPartialDelivery(shelf(), order(), [
      { lineIndex: 0, units: 3 },
      { lineIndex: 1, units: 3 },
    ]);
    const second = commitPartialDelivery(first.inventory, { ...order(), items: first.items }, [
      { lineIndex: 0, units: 5 },
    ]);
    expect(second.stockCommittedAt).toBeTruthy();
    expect(stockOf(second.inventory, 101)).toBe(15);
  });

  // The one that matters. Every deduction is `wanted - alreadyCommitted`, so a
  // resubmitted manifest is arithmetic that comes out at zero rather than a
  // guard somebody has to remember to write.
  it("deducts nothing when the same manifest is recorded twice", () => {
    const before = shelf();
    const source = order();
    const manifest = [
      { lineIndex: 0, units: 3 },
      { lineIndex: 1, units: 3 },
    ];

    const first = commitPartialDelivery(before, source, manifest);
    const second = commitPartialDelivery(first.inventory, { ...source, items: first.items }, manifest);

    expect(stockOf(second.inventory, 101)).toBe(stockOf(first.inventory, 101));
    expect(stockOf(second.inventory, 102)).toBe(stockOf(first.inventory, 102));
    // And the same array back, because nothing moved.
    expect(second.inventory).toBe(first.inventory);
  });

  it("cannot take more off the shelf than the order asked for", () => {
    // A typo of 500 in a quantity box, which is exactly how an unbounded number
    // reached Postgres during class testing.
    const { inventory } = commitPartialDelivery(shelf(), order(), [
      { lineIndex: 0, units: 500 },
    ]);
    expect(stockOf(inventory, 101)).toBe(15);
  });
});

describe("marking an order done", () => {
  it("takes only the remainder when part of it already went", () => {
    const partial = commitPartialDelivery(shelf(), order(), [{ lineIndex: 0, units: 3 }]);
    const { inventory } = commitOrder(partial.inventory, {
      ...order(),
      items: partial.items,
    });

    // 3 already gone plus the 2 left, and the 3 sheets. Not 5 balls twice.
    expect(stockOf(inventory, 101)).toBe(15);
    expect(stockOf(inventory, 102)).toBe(17);
  });

  it("deducts nothing on a second press", () => {
    const first = commitOrder(shelf(), order());
    const second = commitOrder(first.inventory, {
      ...order(),
      items: first.items,
      stockCommittedAt: first.stockCommittedAt,
    });
    expect(second.inventory).toBe(first.inventory);
  });
});

describe("putting a committed order back to waiting", () => {
  it("gives back what actually left", () => {
    const committed = commitOrder(shelf(), order());
    const { inventory, stockCommittedAt } = uncommitOrder(committed.inventory, {
      ...order(),
      items: committed.items,
      stockCommittedAt: committed.stockCommittedAt,
    });

    expect(stockOf(inventory, 101)).toBe(20);
    expect(stockOf(inventory, 102)).toBe(20);
    expect(stockCommittedAt).toBeNull();
  });

  // An order stamped before the per-line counters existed has no record of what
  // left. Reading its counters as zero would strand that stock off the shelf
  // for good, which is the one way this change could have broken live data.
  it("still restores an order stamped before the counters existed", () => {
    const legacy = {
      id: 2,
      status: ORDER_STATUS.COMPLETED,
      stockCommittedAt: "Sep 1, 2026",
      items: [{ productId: 101, name: "Styro Ball 6in", price: 40, quantity: 4 }],
    };
    const { inventory } = uncommitOrder(shelf(10), legacy);
    expect(stockOf(inventory, 101)).toBe(14);
  });
});

describe("goods coming back", () => {
  /** Everything sent, then the customer rejects some of it. */
  const sent = () => {
    const committed = commitOrder(shelf(), order());
    return {
      inventory: committed.inventory,
      order: {
        ...order(),
        items: committed.items,
        stockCommittedAt: committed.stockCommittedAt,
      },
    };
  };

  it("puts a good return back on the shelf", () => {
    const after = sent();
    const { inventory, scrapped } = handleRefundStock(after.inventory, after.order, [
      { lineIndex: 0, units: 2, disposition: REFUND_DISPOSITION.RESTOCK },
    ]);

    expect(stockOf(inventory, 101)).toBe(17);
    expect(scrapped).toEqual([]);
  });

  // The whole reason the disposition is a required question. A cracked sheet
  // put back on the shelf is stock that will never sell, and the shelf would go
  // on offering it to the next customer.
  it("does not put a scrapped return back on the shelf", () => {
    const after = sent();
    const { inventory, scrapped } = handleRefundStock(after.inventory, after.order, [
      { lineIndex: 0, units: 2, disposition: REFUND_DISPOSITION.SCRAP },
    ]);

    expect(stockOf(inventory, 101)).toBe(15);
    expect(scrapped).toEqual([{ productId: 101, name: "Styro Ball 6in", units: 2 }]);
  });

  it("leaves nothing owed either way, so neither changes what is reserved", () => {
    const after = sent();
    const restocked = handleRefundStock(after.inventory, after.order, [
      { lineIndex: 0, units: 2, disposition: REFUND_DISPOSITION.RESTOCK },
    ]);
    const scrapped = handleRefundStock(after.inventory, after.order, [
      { lineIndex: 0, units: 2, disposition: REFUND_DISPOSITION.SCRAP },
    ]);

    const owedAfterRestock = reservedByProduct([{ ...after.order, items: restocked.items }]);
    const owedAfterScrap = reservedByProduct([{ ...after.order, items: scrapped.items }]);
    expect(owedAfterRestock.get(101)).toBeUndefined();
    expect(owedAfterScrap.get(101)).toBeUndefined();
  });

  // Cancelled after paying, before anything shipped. Same three lines of code,
  // and the right answer falls out: no stock moves, the promise disappears.
  it("moves no stock when nothing had shipped, and releases what was set aside", () => {
    const before = shelf();
    const { inventory, items } = handleRefundStock(before, order(), [
      { lineIndex: 0, units: 5, disposition: REFUND_DISPOSITION.RESTOCK },
    ]);

    expect(inventory).toBe(before);
    expect(reservedByProduct([{ ...order(), items }]).get(101)).toBeUndefined();
  });

  it("cannot give back the same units twice", () => {
    const after = sent();
    const first = handleRefundStock(after.inventory, after.order, [
      { lineIndex: 0, units: 5, disposition: REFUND_DISPOSITION.RESTOCK },
    ]);
    const second = handleRefundStock(first.inventory, { ...after.order, items: first.items }, [
      { lineIndex: 0, units: 5, disposition: REFUND_DISPOSITION.RESTOCK },
    ]);

    expect(stockOf(first.inventory, 101)).toBe(20);
    expect(stockOf(second.inventory, 101)).toBe(20);
  });
});

describe("applyReservations", () => {
  // Load-bearing: the caller runs this from an effect that also writes to
  // Supabase, so a fresh array every render would be an infinite loop and a
  // write per frame.
  it("hands back the same array when nothing changed", () => {
    const before = applyReservations(shelf(), [order()]);
    expect(applyReservations(before, [order()])).toBe(before);
  });

  it("frees the shelf up again once goods are written off", () => {
    const withOrder = applyReservations(shelf(), [order()]);
    expect(withOrder.find((row) => row.id === 101).reserved).toBe(5);

    const cancelled = applyReservations(withOrder, [
      { ...order(), status: ORDER_STATUS.CANCELLED },
    ]);
    expect(cancelled.find((row) => row.id === 101).reserved).toBe(0);
  });
});
