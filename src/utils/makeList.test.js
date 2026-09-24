// What puts a product on the make list, and what takes it off again.
//
// The list is worked out on every read from three things: the reorder point,
// the count on the shelf, and what is owed to customers. Nothing is stored, so
// a list that reads wrong is one of those three being wrong -- and the reorder
// point is the one somebody types. These tests pin down that correcting it is
// enough to fix the list, and that the count the ledger holds is the one that
// decides, since that is the copy the product form writes alongside the
// catalogue's.
import { describe, expect, it } from "vitest";

import { makeList } from "./dashboard";
import { stockForProduct } from "./productStock";

const product = (over = {}) => ({
  id: 1, itemCode: "SB-040", name: "Styro Ball 4 inch", status: "Active", ...over,
});
const shelf = (over = {}) => ({
  id: 501, sku: "SB-040", name: "Styro Ball 4 inch", category: "Balls",
  stock: 10, reserved: 0, maxStock: 0, lowStockThreshold: 20, unit: "piece", packSize: 1, ...over,
});

describe("the reorder point decides what is on the make list", () => {
  it("lists a product under its reorder point, and says how many it is short", () => {
    const rows = makeList({ products: [product()], inventory: [shelf()], orders: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ needed: 10, urgency: "Running low" });
    expect(rows[0].product.itemCode).toBe("SB-040");
  });

  it("takes it off once a reorder point typed too high is put right", () => {
    const corrected = makeList({
      products: [product()], inventory: [shelf({ lowStockThreshold: 5 })], orders: [],
    });
    expect(corrected).toEqual([]);
  });

  it("follows the reorder point on the stock row, which is the one the product form writes", () => {
    // The two copies disagreeing is what a half-finished edit looks like; the
    // ledger's is the one every screen and the make list read.
    const stock = stockForProduct(
      product({ lowStockThreshold: 200 }), [shelf({ lowStockThreshold: 5 })], []);
    expect(stock.threshold).toBe(5);
    expect(stock.isLow).toBe(false);
  });

  it("calls a product that has run out run out, whatever its reorder point", () => {
    const rows = makeList({
      products: [product()], inventory: [shelf({ stock: 0, lowStockThreshold: 0 })], orders: [],
    });
    expect(rows[0]).toMatchObject({ urgency: "Run out", onShelf: 0 });
  });

  it("says nothing about a product with no stock row rather than calling it empty", () => {
    expect(makeList({ products: [product()], inventory: [], orders: [] })).toEqual([]);
    expect(stockForProduct(product(), [], [])).toEqual({ tracked: false });
  });
});
