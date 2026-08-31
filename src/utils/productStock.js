/**
 * Stock levels for catalog products.
 *
 * The `products` catalog and the `inventory` ledger are separate tables owned
 * by different roles, and nothing joins them in the database. They do line up
 * on code, though — products.itemCode is the same string as inventory.sku — so
 * this is where that match is made, once, for every screen that needs to show
 * a catalog entry's stock.
 *
 * Read-only by design: the catalog screens display stock, the inventory
 * workspace still owns it. A product with no matching inventory row reports
 * `tracked: false` rather than zero — "we don't know" and "we have none" are
 * different answers, and showing 0 for the first would be a lie.
 */

import { availableOf, statusOf } from "./stockLedger";

/** sku (lowercased) -> inventory row. Build once, reuse across a list render. */
export function stockIndex(inventory = []) {
  return new Map(
    inventory.map((item) => [String(item.sku || "").toLowerCase(), item])
  );
}

/**
 * The stock picture for one catalog product.
 *
 * `threshold` prefers the inventory row's own low-stock level, since that's
 * what the workspace alerts on; the catalog's copy is the fallback so the two
 * screens don't disagree when only one has been filled in.
 */
export function stockFor(product, index) {
  const row = index.get(String(product?.itemCode || "").toLowerCase());
  if (!row) return { tracked: false };

  const available = availableOf(row);
  const threshold = Number(
    row.lowStockThreshold ?? product?.lowStockThreshold ?? 0
  );

  return {
    tracked: true,
    onHand: Number(row.stock) || 0,
    reserved: Number(row.reserved) || 0,
    available,
    threshold,
    unit: row.unit,
    packSize: row.packSize,
    status: statusOf(row),
    isLow: available <= threshold,
    isOut: available <= 0,
  };
}

/** Convenience for a single lookup where building an index would be overkill. */
export function stockForProduct(product, inventory = []) {
  return stockFor(product, stockIndex(inventory));
}

/**
 * Catalog entries at or below their stock threshold, most urgent first.
 * Untracked products are skipped — with no stock row there is nothing to
 * compare against, and reporting them as out of stock would be wrong.
 */
export function lowStockProducts(products = [], inventory = []) {
  const index = stockIndex(inventory);

  return products
    .map((product) => ({ product, stock: stockFor(product, index) }))
    .filter(({ stock }) => stock.tracked && stock.isLow)
    .sort((a, b) => a.stock.available - b.stock.available);
}
