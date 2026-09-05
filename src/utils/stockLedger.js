/**
 * Stock bookkeeping. Pure functions — no React, no Supabase.
 *
 * Two numbers per product, and they move for different reasons:
 *
 *   reserved — DERIVED. The sum of stock units still OWED across every Pending
 *              order, recomputed from the orders array whenever it changes.
 *   stock    — on hand. Only ever moved by a real physical event: goods leaving
 *              the building, or goods coming back through the door.
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
 * whether it already happened.
 *
 * THREE COUNTERS PER LINE, AND WHY THERE ARE THREE.
 *
 * `order.stockCommittedAt` records that deduction for a WHOLE order, which was
 * enough while the only way to finish one was to send all of it at once. It
 * cannot say "three of the five went out" — and three of five going out is an
 * ordinary Tuesday here, because the van was full or the customer only wanted
 * half of it today. So the unit of account is the LINE, and each one carries:
 *
 *   stockUnits      what was ordered. Never changes, ever. It is the record of
 *                   what was asked for, and editing it would destroy that.
 *   committedUnits  how many have physically left the building. Up when a van
 *                   departs, down when goods come back through the door.
 *   voidedUnits     how many were refunded or cancelled and will never ship.
 *
 *   outstanding = max(0, stockUnits - committedUnits - voidedUnits)
 *
 * and `reserved` sums OUTSTANDING. Both new counters default to 0, so an order
 * written before they existed computes exactly what it computed before.
 *
 * committedUnits is the per-line analogue of stockCommittedAt and buys the same
 * guarantee: every deduction is computed as `wanted - alreadyCommitted`, so
 * pressing the button twice deducts nothing the second time. That is the
 * property to preserve when changing anything below.
 *
 * WHERE THEY LIVE. On the line objects inside `orders.items`, which is untyped
 * jsonb and passed through wholesale by the mapper — so none of this is a
 * migration, and normalizeItem's `{ ...item }` spread carries them for free.
 *
 * Units: stock and reserved count SELLING units, not pieces. A sheet sold by
 * the bundle stores 25 to mean 25 bundles.
 */

import { ORDER_STATUS, REFUND_DISPOSITION, STOCK_STATUS } from './constants';
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

// ---- the three counters ----------------------------------------------------

const positive = (value) => Math.max(0, Number(value) || 0);

/** What the line asked for. */
export const orderedOf = (line) => positive(line?.stockUnits);

/** How much of it has physically left the building. */
export const committedOf = (line) => positive(line?.committedUnits);

/** How much of it was refunded or cancelled and will never ship. */
export const voidedOf = (line) => positive(line?.voidedUnits);

/** How much is still owed to the customer. This is what `reserved` sums. */
export function outstandingOf(line) {
  return Math.max(0, orderedOf(line) - committedOf(line) - voidedOf(line));
}

/**
 * True when the lines were written before the counters existed AND the order
 * has already been committed — so its whole draw is out there, unrecorded.
 *
 * Checked as `undefined` rather than falsy: a line that has been through a
 * partial delivery and had everything returned carries a real 0, and that is
 * not the same fact at all.
 */
const isLegacyCommitted = (order, lines) =>
  Boolean(order?.stockCommittedAt) && lines.every((line) => line.committedUnits === undefined);

/** productId -> units still owed, across Pending orders only. */
export function reservedByProduct(orders) {
  const totals = new Map();
  for (const order of orders || []) {
    if (order?.status !== ORDER_STATUS.PENDING) continue;
    for (const line of normalizeItems(order.items)) {
      const owed = outstandingOf(line);
      if (!line.productId || !owed) continue;
      totals.set(line.productId, (totals.get(line.productId) || 0) + owed);
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

/** The stock an order still has to draw, as productId -> units. */
function drawOf(order) {
  const draw = new Map();
  for (const line of normalizeItems(order?.items)) {
    const owed = outstandingOf(line);
    if (!line.productId || !owed) continue;
    draw.set(line.productId, (draw.get(line.productId) || 0) + owed);
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

/** The date shape the rest of the app already stores in stockCommittedAt. */
const stampFor = (now) =>
  now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** True when nothing on the order is still owed. */
const isSettled = (lines) => lines.every((line) => outstandingOf(line) === 0);

/**
 * Deducts on-hand stock for a completed order. No-op if the order already
 * carries a commit stamp, which is what makes a second Pending -> Completed
 * flip harmless.
 *
 * Deducts what is still OUTSTANDING rather than the full order, so marking an
 * order done after part of it already went out takes only the remainder off the
 * shelf. On an order that has never been dispatched the two are the same
 * number, which is why this stays a drop-in replacement.
 *
 * Returns { inventory, items, stockCommittedAt } — the caller writes all three
 * back onto the order so the counters and the stamp stay in step.
 */
export function commitOrder(inventory, order, now = new Date()) {
  const lines = normalizeItems(order?.items);

  if (order?.stockCommittedAt) {
    return { inventory, items: lines, stockCommittedAt: order.stockCommittedAt };
  }

  const items = lines.map((line) => {
    const owed = outstandingOf(line);
    return owed > 0 ? { ...line, committedUnits: committedOf(line) + owed } : line;
  });

  return {
    inventory: moveStock(inventory, drawOf(order), -1),
    items,
    stockCommittedAt: stampFor(now),
  };
}

/**
 * Puts a committed order's stock back — for a Completed order moved back to
 * Pending. No-op unless the order was actually committed.
 *
 * Returns what actually LEFT, which is the sum of committedUnits — not the sum
 * of stockUnits. Those differ the moment any of it was refunded, and giving
 * back more than went out would invent stock.
 */
export function uncommitOrder(inventory, order) {
  const lines = normalizeItems(order?.items);

  if (!order?.stockCommittedAt) {
    return { inventory, items: lines, stockCommittedAt: null };
  }

  // An order stamped before the counters existed has no per-line record of what
  // left, and its whole draw did. Reading its counters as 0 would strand that
  // stock off the shelf permanently.
  const legacy = isLegacyCommitted(order, lines);

  const back = new Map();
  const items = lines.map((line) => {
    const units = legacy ? orderedOf(line) : committedOf(line);
    if (line.productId && units) {
      back.set(line.productId, (back.get(line.productId) || 0) + units);
    }
    return { ...line, committedUnits: 0 };
  });

  return { inventory: moveStock(inventory, back, +1), items, stockCommittedAt: null };
}

/**
 * Records what physically went out on one delivery, which may be less than the
 * order asked for.
 *
 * `delivered` is [{ lineIndex, units }] — the manifest somebody filled in
 * standing at the van. Each line is deducted by `units - alreadyCommitted` and
 * never by more, so re-submitting the same manifest deducts nothing: that
 * subtraction is the whole defence against double deduction, and it is the one
 * expression in this file worth being careful about.
 *
 * A line is also capped at what is left unvoided, so a typo of 500 in a
 * quantity box cannot take 500 off a shelf holding 12.
 *
 * Returns { inventory, items, stockCommittedAt } — stamped only once nothing on
 * the order is still owed, because that stamp means "this order is finished
 * with the shelf", not "a van left".
 */
export function commitPartialDelivery(inventory, order, delivered = [], now = new Date()) {
  const wanted = new Map();
  for (const entry of delivered || []) {
    const index = Number(entry?.lineIndex);
    if (!Number.isInteger(index) || index < 0) continue;
    wanted.set(index, positive(entry.units));
  }

  const draw = new Map();
  const items = normalizeItems(order?.items).map((line, index) => {
    if (!wanted.has(index)) return line;

    const already = committedOf(line);
    const ceiling = Math.max(0, orderedOf(line) - voidedOf(line));
    const target = Math.min(wanted.get(index), ceiling);
    const delta = target - already;
    if (delta <= 0) return line;

    if (line.productId) {
      draw.set(line.productId, (draw.get(line.productId) || 0) + delta);
    }
    return { ...line, committedUnits: already + delta };
  });

  const settled = isSettled(items);
  return {
    inventory: moveStock(inventory, draw, -1),
    items,
    stockCommittedAt: settled ? order?.stockCommittedAt || stampFor(now) : null,
  };
}

/**
 * Puts refunded goods back where they belong — which for a lot of what this
 * business sells is nowhere.
 *
 * `refundLines` is [{ lineIndex, units, disposition }]. One rule covers every
 * case, and the cases only look different from outside:
 *
 *   returnable      = min(units, committedUnits)   what actually shipped
 *   committedUnits -= returnable                   it is back, or it is gone
 *   voidedUnits    += units                        none of it will ship again
 *   stock          += returnable, for a restock ONLY
 *
 * Rejected on the doorstep and put back on the shelf: on-hand up, reserved
 * unchanged. Rejected and scrapped: on-hand unchanged, because a cracked sheet
 * is not stock — it is waste, and it is reported as waste. Cancelled before
 * anything shipped: `returnable` is 0, no stock moves, and reserved simply
 * falls away. Same three lines each time.
 *
 * Returns { inventory, items, scrapped } — `scrapped` is what the caller writes
 * into the activity feed, because material loss nobody records is material loss
 * nobody can explain at the end of the month.
 */
export function handleRefundStock(inventory, order, refundLines = []) {
  const byIndex = new Map();
  for (const entry of refundLines || []) {
    const index = Number(entry?.lineIndex);
    const units = positive(entry?.units);
    if (!Number.isInteger(index) || index < 0 || !units) continue;
    byIndex.set(index, {
      units,
      disposition:
        entry.disposition === REFUND_DISPOSITION.RESTOCK
          ? REFUND_DISPOSITION.RESTOCK
          : REFUND_DISPOSITION.SCRAP,
    });
  }

  const back = new Map();
  const scrapped = [];

  const items = normalizeItems(order?.items).map((line, index) => {
    const entry = byIndex.get(index);
    if (!entry) return line;

    const committed = committedOf(line);
    const returnable = Math.min(entry.units, committed);

    if (returnable > 0) {
      if (entry.disposition === REFUND_DISPOSITION.RESTOCK) {
        if (line.productId) {
          back.set(line.productId, (back.get(line.productId) || 0) + returnable);
        }
      } else {
        scrapped.push({
          productId: line.productId ?? null,
          name: line.name,
          units: returnable,
        });
      }
    }

    return {
      ...line,
      committedUnits: committed - returnable,
      voidedUnits: Math.min(orderedOf(line), voidedOf(line) + entry.units),
    };
  });

  return { inventory: moveStock(inventory, back, +1), items, scrapped };
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
