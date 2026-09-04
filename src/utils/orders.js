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
 * HOW AN ORDER FINDS ITS DELIVERY. There is no foreign key: the deliveries
 * table stores a free-text `product` field, and the workspace screens have
 * always written "Order #12 - Styro Balls" into it. That convention is the
 * link, and it is matched here rather than in four components. The trailing
 * "-" is load-bearing — without it "Order #1" matches "Order #123".
 */

import { DELIVERY_STAGE, ORDER_STATUS } from "./constants";
import { deliveryStageIndex } from "./copy";
import { normalizeItems, orderTotal } from "./orderItems";
import { formatShortDate } from "./profileFormat";

export const ORDER_STAGES = ["Written", "Being made", "Ready to go", "Delivered"];

/** Does this delivery row belong to that order? See the note above on "-". */
export const deliveryBelongsToOrder = (delivery, orderId) =>
  String(delivery?.product || "").startsWith(`Order #${orderId} - `);

export const deliveryForOrder = (order, deliveries = []) =>
  deliveries.find((delivery) => deliveryBelongsToOrder(delivery, order?.id));

/**
 * Which of the four stages an order is at, and the date under each.
 *
 * Returns `{ current, stages, cancelled }`. `current` is the index in progress;
 * everything before it is done. A completed order returns
 * `current = stages.length`, i.e. all four done and none in progress.
 */
export function orderProgress(order, deliveries = []) {
  const written = formatShortDate(order?.createdAt);

  if (order?.status === ORDER_STATUS.CANCELLED) {
    return { cancelled: true, current: 0, stages: [] };
  }

  const delivery = deliveryForOrder(order, deliveries);
  const deliveryIndex = delivery ? deliveryStageIndex(delivery.status) : null;

  let current;
  if (order?.status === ORDER_STATUS.COMPLETED || delivery?.status === DELIVERY_STAGE.ARRIVED) {
    current = 4;
  } else if (deliveryIndex !== null && deliveryIndex >= 2) {
    current = 2;
  } else {
    current = 1;
  }

  const stages = ORDER_STAGES.map((label, index) => ({
    label,
    at:
      index === 0
        ? written
        : index === 3 && order?.stockCommittedAt
          ? formatShortDate(order.stockCommittedAt)
          : undefined,
  }));

  return { cancelled: false, current, stages };
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

/** Totals for the order footer: items, delivery, and what the customer pays. */
export function orderTotals(order, deliveries = []) {
  const items = orderTotal(order?.items);
  const delivery = Number(deliveryForOrder(order, deliveries)?.amount) || 0;
  // `total_amount` is what was agreed and stored; the item sum is what the
  // lines add up to now. They differ when a line was edited after the fact, and
  // the STORED figure is the one the customer was told, so it wins.
  const stored = Number(order?.totalAmount);
  const total = Number.isFinite(stored) && stored > 0 ? stored : items + delivery;
  return { items, delivery, total };
}

/** How many orders are in each state, from the unfiltered set. */
export function orderCounts(orders = []) {
  return {
    all: orders.length,
    waiting: orders.filter((o) => o.status === ORDER_STATUS.PENDING).length,
    done: orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).length,
    cancelled: orders.filter((o) => o.status === ORDER_STATUS.CANCELLED).length,
  };
}
