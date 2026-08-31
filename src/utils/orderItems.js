/**
 * Order line items.
 *
 * An order line is one of four kinds (see LINE_KIND):
 *
 *   catalog    — a stocked product sold at its catalog price
 *   negotiated — a stocked product at an agreed price; listPrice keeps the
 *                catalog price at the time of the order, for margin reporting
 *   cut        — a sheet or block cut to the customer's dimensions. Priced by
 *                hand; draws whole parent sheets from stock
 *   custom     — a carved or shaped piece. Priced by hand; draws no tracked
 *                stock, because the material isn't a catalog row
 *
 * Every kind carries the same five fields — name, quantity, unitPrice,
 * lineTotal, stockUnits — so totals and stock maths never branch on kind. Only
 * the editor cares which kind it is.
 *
 * Lines written before this shape existed are `{ productId, name, price,
 * quantity }`. normalizeItem fills in the rest, so old orders keep rendering.
 */

import { LINE_KIND } from './constants';

/**
 * Fills in the fields a line is missing so every reader can treat all lines
 * alike. Run stored items through this before using them.
 *
 * `price` is written back alongside `unitPrice` on purpose: OrderDetail and
 * DeliveryList still read `item.price`, and an undefined there is a render
 * crash rather than a blank cell.
 */
export function normalizeItem(item) {
  if (!item) return null;

  const kind = item.kind || (item.productId ? LINE_KIND.CATALOG : LINE_KIND.CUSTOM);
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice ?? item.price) || 0;
  const lineTotal =
    item.lineTotal === undefined || item.lineTotal === null
      ? unitPrice * quantity
      : Number(item.lineTotal) || 0;

  // A custom shape consumes no catalog stock. Everything else defaults to one
  // stock unit per item ordered, which is what pre-existing lines meant.
  const stockUnits =
    item.stockUnits === undefined || item.stockUnits === null
      ? kind === LINE_KIND.CUSTOM
        ? 0
        : quantity
      : Number(item.stockUnits) || 0;

  return { ...item, kind, quantity, unitPrice, price: unitPrice, lineTotal, stockUnits };
}

export function normalizeItems(items) {
  return (items || []).map(normalizeItem).filter(Boolean);
}

/** Order total. Identical arithmetic for every kind. */
export function orderTotal(items) {
  return normalizeItems(items).reduce((sum, item) => sum + item.lineTotal, 0);
}

/** Recomputes lineTotal after a quantity or price edit. */
export function withLineTotal(item) {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  return { ...item, quantity, unitPrice, price: unitPrice, lineTotal: unitPrice * quantity };
}

/** True when the line draws from a tracked inventory row. */
export function drawsStock(item) {
  const line = normalizeItem(item);
  return Boolean(line && line.productId && line.stockUnits > 0);
}
