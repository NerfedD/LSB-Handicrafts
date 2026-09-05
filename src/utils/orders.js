/**
 * Orders, as the screens need them.
 *
 * THE STAGE TRACKER IS DERIVED, NOT STORED. The order detail screen replaces a
 * status word with four stages — Written, Being made, Ready to go, Delivered —
 * because "Pending" tells somebody the state without telling them what happens
 * next or how much is left. There is no `stage` column, and adding one would
 * mean two places that can disagree about where an order is: the column, and
 * the delivery that is actually carrying it.
 *
 * So the stage is computed from what is already true:
 *
 *   Written      always done. Dated from the order's own created_at.
 *   Being made   an order that is still Pending and whose delivery has not
 *                been marked ready.
 *   Ready to go  the delivery is packed or on the road.
 *   Delivered    the order is Completed, or its delivery has arrived.
 *
 * A cancelled order has no stage at all and the screen says so instead of
 * drawing a tracker that will never finish.
 *
 * WHAT A BACKORDER DID TO THAT. An order can now be part-delivered, and the
 * fourth stage says "Partly delivered" and stays IN PROGRESS rather than done.
 * It is deliberately not a fifth stage: the four indexes are read by the
 * tracker, by the tests and by anything that compares progress between orders,
 * and a partly-delivered order has not reached a new place — it is standing in
 * the last one, unfinished. Same four circles, honest label.
 *
 * HOW AN ORDER FINDS ITS DELIVERY. There is no foreign key: the deliveries
 * table stores a free-text `product` field, and the workspace screens have
 * always written "Order #12 - Ana Reyes" into it. That convention is the
 * link, and it is matched here rather than in four components. The trailing
 * "-" is load-bearing — without it "Order #1" matches "Order #123".
 *
 * AN ORDER CAN NOW HAVE MORE THAN ONE. When goods are left behind, a follow-up
 * delivery is raised as "Order #12 - Ana Reyes (backorder)" — the SAME prefix,
 * deliberately, so every existing matcher keeps working untouched. What changed
 * is that `deliveryForOrder` now answers "the one still in play" rather than
 * "the first one found", because after the first van is home the interesting
 * delivery is the second.
 */

import { DELIVERY_STAGE, ORDER_STATUS, BACKORDER_STATUS } from "./constants";
import { deliveryStageIndex } from "./copy";
import { normalizeItems, orderTotal } from "./orderItems";
import { committedOf, outstandingOf } from "./stockLedger";
import { formatShortDate } from "./profileFormat";

export const ORDER_STAGES = ["Written", "Being made", "Ready to go", "Delivered"];

/** What the fourth stage is called when part of the order is still owed. */
export const PARTLY_DELIVERED = "Partly delivered";

/** The suffix that marks a follow-up delivery for goods left behind. */
export const BACKORDER_SUFFIX = " (backorder)";

/** Does this delivery row belong to that order? See the note above on "-". */
export const deliveryBelongsToOrder = (delivery, orderId) =>
  String(delivery?.product || "").startsWith(`Order #${orderId} - `);

/** Is this the follow-up run rather than the original one? */
export const isBackorderDelivery = (delivery) =>
  Boolean(delivery?.parentDeliveryId) ||
  String(delivery?.product || "").endsWith(BACKORDER_SUFFIX);

/**
 * Every delivery raised for an order, oldest first. The original is always
 * first, because ids are minted in order and a follow-up can only exist after
 * the run it follows.
 */
export const deliveriesForOrder = (order, deliveries = []) =>
  deliveries
    .filter((delivery) => deliveryBelongsToOrder(delivery, order?.id))
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

/**
 * The delivery worth looking at: the one still on its way, or the most recent
 * if they have all arrived.
 *
 * Not simply the first any more. An order whose original run is home and whose
 * backorder has not left is not "arrived" — showing the finished run would
 * report an order as delivered while the customer is still waiting for half
 * of it.
 */
export function deliveryForOrder(order, deliveries = []) {
  const all = deliveriesForOrder(order, deliveries);
  if (all.length === 0) return undefined;
  const live = all.filter((delivery) => delivery.status !== DELIVERY_STAGE.ARRIVED);
  return live.length > 0 ? live[0] : all[all.length - 1];
}

/** The original run. Its charge is the one the customer agreed to pay. */
export const originalDeliveryForOrder = (order, deliveries = []) =>
  deliveriesForOrder(order, deliveries).find((delivery) => !isBackorderDelivery(delivery));

// ---- backorders ------------------------------------------------------------

/**
 * The lines with goods still owed after some of the order has already gone out.
 *
 * BOTH HALVES MATTER. `committedOf > 0` says part of this line has physically
 * left; `outstandingOf > 0` says part of it has not. A line where nothing has
 * left yet is not a backorder — it is simply an order waiting its turn, and
 * calling it a backorder would put every open order under the amber chip and
 * make the chip worthless.
 */
export function backorderLines(order) {
  return normalizeItems(order?.items)
    .map((line, index) => ({ ...line, index }))
    .filter((line) => committedOf(line) > 0 && outstandingOf(line) > 0);
}

/** Is this order still owing the customer goods it has already started sending? */
export function hasBackorder(order) {
  if (!order || order.status !== ORDER_STATUS.PENDING) return false;
  return backorderLines(order).length > 0;
}

/**
 * The word written into `orders.backorder_status`.
 *
 * A CACHE FOR SQL, NOT A SOURCE. Nothing in the app reads it back —
 * hasBackorder above is what the screens ask. See the note on BACKORDER_STATUS
 * in utils/constants.
 */
export function backorderStatusOf(order) {
  if (hasBackorder(order)) return BACKORDER_STATUS.PARTIAL;
  const everSplit = normalizeItems(order?.items).some((line) => committedOf(line) > 0);
  return everSplit && order?.status !== ORDER_STATUS.PENDING
    ? BACKORDER_STATUS.RESOLVED
    : BACKORDER_STATUS.NONE;
}

/**
 * productId -> units owed on a backorder, across every open order. What the
 * make list puts at the top: stock somebody is already waiting for beats stock
 * that has merely fallen below a warning level.
 */
export function backorderDemand(orders = []) {
  const totals = new Map();
  for (const order of orders) {
    if (!hasBackorder(order)) continue;
    for (const line of backorderLines(order)) {
      if (!line.productId) continue;
      totals.set(line.productId, (totals.get(line.productId) || 0) + outstandingOf(line));
    }
  }
  return totals;
}

// ---- money -----------------------------------------------------------------

/** What was given back across every refund on this order. */
export const orderRefunded = (order) => Number(order?.refundedAmount) || 0;

/** What the customer is actually out of pocket: the total, less what came back. */
export const orderNetTotal = (order) =>
  Math.max(0, (Number(order?.totalAmount) || 0) - orderRefunded(order));

/** Has any money gone back on this order? */
export const hasRefund = (order) => orderRefunded(order) > 0;

/** The most recent price correction, for the banner on the order screen. */
export function lastPriceAdjustment(order) {
  const history = Array.isArray(order?.priceAdjustments) ? order.priceAdjustments : [];
  return history.length > 0 ? history[history.length - 1] : null;
}

// ---- progress --------------------------------------------------------------

/**
 * Which of the four stages an order is at, and the date under each.
 *
 * Returns `{ current, stages, cancelled, partial }`. `current` is the index in
 * progress; everything before it is done. A completed order returns
 * `current = stages.length`, i.e. all four done and none in progress.
 */
export function orderProgress(order, deliveries = []) {
  const written = formatShortDate(order?.createdAt);

  if (order?.status === ORDER_STATUS.CANCELLED) {
    return { cancelled: true, partial: false, current: 0, stages: [] };
  }

  const delivery = deliveryForOrder(order, deliveries);
  const deliveryIndex = delivery ? deliveryStageIndex(delivery.status) : null;
  const partial = hasBackorder(order);

  let current;
  if (partial) {
    // Standing in the last stage, not past it. Some of it is with the
    // customer; the rest has not left the building.
    current = 3;
  } else if (
    order?.status === ORDER_STATUS.COMPLETED ||
    delivery?.status === DELIVERY_STAGE.ARRIVED
  ) {
    current = 4;
  } else if (deliveryIndex !== null && deliveryIndex >= 2) {
    current = 2;
  } else {
    current = 1;
  }

  const stages = ORDER_STAGES.map((label, index) => ({
    label: index === 3 && partial ? PARTLY_DELIVERED : label,
    at:
      index === 0
        ? written
        : index === 3 && order?.stockCommittedAt
          ? formatShortDate(order.stockCommittedAt)
          : undefined,
  }));

  return { cancelled: false, partial, current, stages };
}

/** How many whole days an order has been waiting. Null once it is finished. */
export function daysWaiting(order) {
  if (!order || order.status !== ORDER_STATUS.PENDING) return null;
  const created = order.createdAt ? new Date(order.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
}

/**
 * The line every orders row shows under the customer's name: how many things
 * are on the order, then the things themselves.
 *
 * Truncated to two names plus a count, because the cell has one line and a
 * fourteen-item order would otherwise push the row height around. The full
 * list is one click away on the order itself.
 */
export function itemSummary(order) {
  const items = normalizeItems(order?.items);
  if (items.length === 0) return { count: 0, label: "Nothing on it yet", names: "" };

  const names = items.map((item) => item.name).filter(Boolean);
  const shown = names.slice(0, 2).join(", ");
  const rest = names.length - 2;

  return {
    count: items.length,
    label: `${items.length} ${items.length === 1 ? "item" : "items"}`,
    names: rest > 0 ? `${shown} and ${rest} more` : shown,
  };
}

/**
 * Totals for the order footer: items, delivery, what was given back, and what
 * the customer actually pays.
 *
 * THE DELIVERY CHARGE COMES FROM THE ORIGINAL RUN ONLY. A backorder is a second
 * trip the shop absorbs, not a second charge — and reading every delivery row
 * for this order would bill the customer twice for a shortfall that was the
 * shop's to fix.
 */
export function orderTotals(order, deliveries = []) {
  const items = orderTotal(order?.items);
  const delivery = Number(originalDeliveryForOrder(order, deliveries)?.amount) || 0;
  // `total_amount` is what was agreed and stored; the item sum is what the
  // lines add up to now. They differ when a line was edited after the fact, and
  // the STORED figure is the one the customer was told, so it wins.
  const stored = Number(order?.totalAmount);
  const total = Number.isFinite(stored) && stored > 0 ? stored : items + delivery;
  const refunded = orderRefunded(order);
  return { items, delivery, total, refunded, net: Math.max(0, total - refunded) };
}

/** How many orders are in each state, from the unfiltered set. */
export function orderCounts(orders = []) {
  return {
    all: orders.length,
    waiting: orders.filter((o) => o.status === ORDER_STATUS.PENDING).length,
    done: orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).length,
    cancelled: orders.filter((o) => o.status === ORDER_STATUS.CANCELLED).length,
    backorder: orders.filter(hasBackorder).length,
    refunded: orders.filter(hasRefund).length,
  };
}
