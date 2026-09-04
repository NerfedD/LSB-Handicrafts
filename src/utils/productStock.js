/**
 * Stock levels for catalog products.
 *
 * The `products` catalog and the `inventory` ledger are separate tables owned
 * by different roles, and nothing joins them in the database. They do line up
 * on code, though — products.itemCode is the same string as inventory.sku — so
 * this is where that match is made, once, for every screen that needs to show
 * a catalog entry's stock.
 *
 * THE UI OVERHAUL COLLAPSES THE TWO INTO ONE SCREEN. "Products & stock" is a
 * single destination, because the split between a catalog entry and its stock
 * level is a database detail and somebody asking "how many 4-inch balls have we
 * got" does not care which table the answer came from. That makes this module
 * load-bearing rather than a convenience: it is the join.
 *
 * Read-only by design. The catalog screens display stock; committing an order
 * is what moves it (see utils/stockLedger). A product with no matching
 * inventory row reports `tracked: false` rather than zero — "we don't know" and
 * "we have none" are different answers, and showing 0 for the first would be a
 * lie the make list would then act on.
 */

import { reservedByProduct, statusOf } from "./stockLedger";

/**
 * sku (lowercased) -> { row, reserved }. Build once, reuse across a render.
 *
 * RESERVED IS RECOMPUTED FROM THE ORDERS, not read from the column.
 * `inventory.reserved` is a cache, and stockLedger has always said the orders
 * array is the source of truth — but the only thing that ever refreshed that
 * cache was the legacy workspace, which the UI overhaul removed. Deriving it on
 * read means it cannot go stale, and it is correct by construction for create,
 * edit, cancel and re-open alike: there is no double-apply bug available to
 * have.
 *
 * The column is left in the database and still written on save, so any SQL
 * reporting built against it keeps working; nothing in the app reads it.
 */
export function stockIndex(inventory = [], orders = []) {
  const reserved = reservedByProduct(orders);
  return new Map(
    inventory.map((item) => [
      String(item.sku || "").toLowerCase(),
      { row: item, reserved: reserved.get(item.id) || 0 },
    ])
  );
}

/**
 * The stock picture for one catalog product.
 *
 * `threshold` prefers the inventory row's own low-stock level, since that's
 * what the workspace alerts on; the catalog's copy is the fallback so the two
 * screens don't disagree when only one has been filled in.
 *
 * `ceiling` is what the stock BAR measures against, and it needs care: a bar
 * with no ceiling has no length. `maxStock` is the storage capacity and is the
 * honest answer where it is set. Where it is not, four times the reorder
 * threshold is used — chosen so a product sitting exactly at its threshold
 * fills a quarter of the bar, which reads as "low" at a glance without being
 * mistaken for empty.
 */
export function stockFor(product, index) {
  const entry = index.get(String(product?.itemCode || "").toLowerCase());
  if (!entry) return { tracked: false };

  const { row, reserved } = entry;
  const onHand = Number(row.stock) || 0;
  const available = onHand - reserved;
  const threshold = Number(row.lowStockThreshold ?? product?.lowStockThreshold ?? 0);
  const maxStock = Number(row.maxStock) || 0;

  return {
    tracked: true,
    onHand,
    reserved,
    available,
    threshold,
    ceiling: maxStock > 0 ? maxStock : Math.max(threshold * 4, onHand, 1),
    // The merchandising label ("Styro Balls"). It lives on the inventory row
    // and has no counterpart in the catalog, so it comes across with the stock
    // rather than the detail screen reaching into a second table for one field.
    category: row.category ?? null,
    unit: row.unit,
    packSize: row.packSize,
    status: statusOf({ ...row, reserved }),
    isLow: available <= threshold,
    isOut: available <= 0,
  };
}

/** Convenience for a single lookup where building an index would be overkill. */
export function stockForProduct(product, inventory = [], orders = []) {
  return stockFor(product, stockIndex(inventory, orders));
}

/**
 * The products screen's row shape: one catalog entry with its stock attached.
 *
 * Built here rather than in the component so the list, the phone card list and
 * the dashboards all derive "a product and how many there are" the same way —
 * three screens computing it separately is three chances for the make list and
 * the products table to disagree about what is running low.
 */
export function shelfItems(products = [], inventory = [], orders = []) {
  const index = stockIndex(inventory, orders);
  return products.map((product) => ({ product, stock: stockFor(product, index) }));
}

/**
 * Catalog entries at or below their stock threshold, most urgent first.
 * Untracked products are skipped — with no stock row there is nothing to
 * compare against, and reporting them as out of stock would be wrong.
 */
export function lowStockProducts(products = [], inventory = [], orders = []) {
  return shelfItems(products, inventory, orders)
    .filter(({ stock }) => stock.tracked && stock.isLow)
    .sort((a, b) => a.stock.available - b.stock.available);
}

/** How many products are in each of the three stock states, plus the total. */
export function stockCounts(products = [], inventory = [], orders = []) {
  const items = shelfItems(products, inventory, orders);
  return {
    all: items.length,
    in: items.filter(({ stock }) => stock.tracked && !stock.isLow && !stock.isOut).length,
    low: items.filter(({ stock }) => stock.tracked && stock.isLow && !stock.isOut).length,
    out: items.filter(({ stock }) => stock.tracked && stock.isOut).length,
    untracked: items.filter(({ stock }) => !stock.tracked).length,
  };
}
