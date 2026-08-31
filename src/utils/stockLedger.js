/**
 * Stock bookkeeping. Pure functions — no React, no Supabase.
 *
 * Two numbers per product, and they move for different reasons:
 *
 *   reserved — DERIVED. The sum of stock units across every Pending order,
 *              recomputed from the orders array whenever it changes.
 *   stock    — on hand. Only ever moved by committing an order, which is a
 *              real one-way event (the goods left the building).
 *
 * `reserved` is recomputed rather than incremented on purpose. The status
 * dropdown lets an order flip Pending -> Completed -> Pending freely, and
 * persistence rewrites whole tables, so an incremental +=/-= has no reliable
 * point to run exactly once. Recomputing from the orders array is correct by
 * construction for create, edit, delete, cancel and re-open alike — there is no
 * double-apply bug available to have. The database column is a cache of this
 * for SQL reporting; the orders array is the source of truth.
 *
 * The one thing that genuinely can't be derived is the deduction: once stock
 * has physically left, no later reading of the orders array can tell you
 * whether it already happened. That's what order.stockCommittedAt records.
 *
 * Units: stock and reserved count SELLING units, not pieces. A sheet sold by
 * the bundle stores 25 to mean 25 bundles.
 */

import { ORDER_STATUS, STOCK_STATUS } from './constants';
import { normalizeItems } from './orderItems';

/** What's actually sellable. Reserved stock is spoken for. */
export function availableOf(item) {
  return (Number(item?.stock) || 0) - (Number(item?.reserved) || 0);
}

/**
 * Stock status, derived from available rather than on-hand — a product whose
 * entire shelf is already promised to pending orders is not "In Stock".
 */
export function statusOf(item) {
  const available = availableOf(item);
  if (available <= 0) return STOCK_STATUS.OUT;
  const threshold = Number(item?.lowStockThreshold);
  return available < (Number.isNaN(threshold) ? 50 : threshold)
    ? STOCK_STATUS.LOW
    : STOCK_STATUS.IN;
}

/** productId -> units promised, across Pending orders only. */
export function reservedByProduct(orders) {
  const totals = new Map();
  for (const order of orders || []) {
    if (order?.status !== ORDER_STATUS.PENDING) continue;
    for (const line of normalizeItems(order.items)) {
      if (!line.productId || !line.stockUnits) continue;
      totals.set(line.productId, (totals.get(line.productId) || 0) + line.stockUnits);
    }
  }
  return totals;
}

/**
 * Returns inventory with `reserved` and `status` recomputed from the orders.
 *
 * Returns the SAME ARRAY REFERENCE when nothing changed. This is load-bearing:
 * the caller runs it from an effect that also writes to Supabase, so a fresh
 * array on every render would be an infinite loop and a write per frame.
 */
export function applyReservations(inventory, orders) {
  const totals = reservedByProduct(orders);
  let changed = false;

  const next = (inventory || []).map((item) => {
    const reserved = totals.get(item.id) || 0;
    const status = statusOf({ ...item, reserved });
    if (item.reserved === reserved && item.status === status) return item;
    changed = true;
    return { ...item, reserved, status };
  });

  return changed ? next : inventory;
}

/** The stock an order draws, as productId -> units. */
function drawOf(order) {
  const draw = new Map();
  for (const line of normalizeItems(order?.items)) {
    if (!line.productId || !line.stockUnits) continue;
    draw.set(line.productId, (draw.get(line.productId) || 0) + line.stockUnits);
  }
  return draw;
}

function moveStock(inventory, draw, sign) {
  if (draw.size === 0) return inventory;
  return inventory.map((item) => {
    const units = draw.get(item.id);
    if (!units) return item;
    const stock = (Number(item.stock) || 0) + sign * units;
    return { ...item, stock };
  });
}

/**
 * Deducts on-hand stock for a completed order. No-op if the order already
 * carries a commit stamp, which is what makes a second Pending -> Completed
 * flip harmless.
 *
 * Returns { inventory, stockCommittedAt } — the caller stamps the order with
 * the returned value so the two stay in step.
 */
export function commitOrder(inventory, order, now = new Date()) {
  if (order?.stockCommittedAt) {
    return { inventory, stockCommittedAt: order.stockCommittedAt };
  }
  return {
    inventory: moveStock(inventory, drawOf(order), -1),
    stockCommittedAt: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

/**
 * Puts a committed order's stock back — for a Completed order moved back to
 * Pending. No-op unless the order was actually committed.
 */
export function uncommitOrder(inventory, order) {
  if (!order?.stockCommittedAt) {
    return { inventory, stockCommittedAt: null };
  }
  return {
    inventory: moveStock(inventory, drawOf(order), +1),
    stockCommittedAt: null,
  };
}

/**
 * Checks an order against what's actually sellable. Returns human-readable
 * messages, empty when clear.
 *
 * `ignoreOrderId` excludes an order's own existing reservation, so editing a
 * pending order doesn't read as competing with itself.
 */
export function stockIssuesForOrder(inventory, order, { orders = [], ignoreOrderId } = {}) {
  const otherOrders = ignoreOrderId
    ? orders.filter((o) => o.id !== ignoreOrderId)
    : orders;
  const reserved = reservedByProduct(otherOrders);
  const issues = [];

  for (const [productId, units] of drawOf(order)) {
    const item = inventory.find((i) => i.id === productId);
    if (!item) continue;
    const available = (Number(item.stock) || 0) - (reserved.get(productId) || 0);
    if (units > available) {
      issues.push(
        `${item.name}: ordering ${units} but only ${Math.max(available, 0)} available.`
      );
    }
  }

  return issues;
}

/**
 * How many pieces of `cut` come out of one `parent` sheet, cutting straight
 * across in one orientation (a guillotine cut — the way sheets are actually
 * trimmed). Takes the better of the two orientations.
 *
 * Deliberately not an area ratio: dividing areas pretends the offcuts can be
 * sold, and they can't. 0 means the cut doesn't fit at all.
 */
export function piecesPerSheet(parent, cut) {
  const pl = Number(parent?.lengthFt);
  const pw = Number(parent?.widthFt);
  const cl = Number(cut?.lengthFt);
  const cw = Number(cut?.widthFt);
  if (!pl || !pw || !cl || !cw) return 0;

  const straight = Math.floor(pl / cl) * Math.floor(pw / cw);
  const turned = Math.floor(pl / cw) * Math.floor(pw / cl);
  return Math.max(straight, turned);
}

/**
 * Parent sheets needed for `qty` pieces of `cut`. Null when the cut doesn't fit
 * the parent — the caller should block the line rather than guess.
 */
export function sheetsNeeded(parent, cut, qty) {
  const per = piecesPerSheet(parent, cut);
  if (per === 0) return null;
  return Math.ceil((Number(qty) || 0) / per);
}
