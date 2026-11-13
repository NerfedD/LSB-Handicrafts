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
import { formatPeso, formatShortDate } from "./profileFormat";
import { roundMoney } from "./money";

export const ORDER_STAGES = ["Written", "Being made", "Ready to go", "Delivered"];

/** What the fourth stage is called when part of the order is still owed. */
export const PARTLY_DELIVERED = "Partly delivered";

/** The suffix that marks a follow-up delivery for goods left behind. */
export const BACKORDER_SUFFIX = " (backorder)";

/**
 * Does this delivery row belong to that order? By `orderId` where the row has
 * one (every delivery raised since the column existed, and every older one the
 * migration could link), by the text otherwise. See the note above on "-".
 */
export const deliveryBelongsToOrder = (delivery, orderId) =>
  delivery?.orderId != null
    ? Number(delivery.orderId) === Number(orderId)
    : String(delivery?.product || "").startsWith(`Order #${orderId} - `);

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
 * BOTH HALVES MATTER, AT THE LEVEL OF THE ORDER. Something on it has
 * physically left (`committedOf > 0` on any line) and something has not
 * (`outstandingOf > 0`). An order where nothing has left yet is not a
 * backorder — it is simply waiting its turn, and calling it one would put
 * every open order under the amber chip and make the chip worthless.
 */
export function backorderLines(order) {
  const lines = normalizeItems(order?.items).map((line, index) => ({ ...line, index }));
  // Something on the ORDER has gone out, not necessarily on the same line: a
  // van that took all of one product and none of another left that whole
  // second line behind, and it is owed exactly as much as half a line is.
  if (!lines.some((line) => committedOf(line) > 0)) return [];
  return lines.filter((line) => outstandingOf(line) > 0);
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
export const orderRefunded = (order) => roundMoney(order?.refundedAmount);

/** What the customer is actually out of pocket: the total, less what came back. */
export const orderNetTotal = (order) =>
  Math.max(0, roundMoney((Number(order?.totalAmount) || 0) - orderRefunded(order)));

/** Has any money gone back on this order? */
export const hasRefund = (order) => orderRefunded(order) > 0;

/**
 * How much of one refund was money handed back, as opposed to taken off what
 * the customer owes. The database stamps `handedBack` on each entry when the
 * refund is saved (private.stamp_refund_money); an entry from before that has
 * none, and counts as handed back in full unless it was left on the account --
 * which is what it claimed at the time.
 */
export function handedBackOf(entry) {
  if (entry?.handedBack !== undefined && entry?.handedBack !== null) return roundMoney(entry.handedBack);
  return entry?.method === "credit" ? 0 : roundMoney(entry?.amount);
}

/**
 * One refund in words, saying which part was money: "₱150.00 given back",
 * "₱100.00 given back, ₱50.00 off what they owe" or "₱150.00 off what they
 * owe". `sentence` is the printed slip's form ("... was given back").
 */
export function refundWords(entry, { sentence = false } = {}) {
  const amount = roundMoney(entry?.amount);
  const handed = Math.min(amount, handedBackOf(entry));
  const off = roundMoney(amount - handed);
  const gave = sentence ? "was given back" : "given back";
  const came = sentence ? "came off what was owed" : "off what they owe";
  if (off <= 0) return `${formatPeso(amount)} ${gave}`;
  if (handed <= 0) return `${formatPeso(amount)} ${came}`;
  return `${formatPeso(handed)} ${gave}${sentence ? " and" : ","} ${formatPeso(off)} ${came}`;
}

/** Money handed back across every refund on this order. */
export const moneyHandedBack = (order) =>
  roundMoney((order?.refundHistory || []).reduce((sum, entry) => sum + handedBackOf(entry), 0));

/**
 * What a refund of `amount` will be split into, worked out the way the
 * database will work it out, so the dialog can say it before it is saved.
 *
 * Money goes back only where the customer has paid more than the order still
 * comes to after the refund; the rest comes off what they owe. Deliveries are
 * paid on 30 or 60 day terms, so for most refunds nothing has been paid yet
 * and all of it comes off the bill. This is a PREVIEW: the figure that counts
 * is the one the database stamps.
 */
export function refundSplit(order, amount, paid, method) {
  const giving = Math.max(0, roundMoney(amount));
  if (method === "credit" || giving === 0) return { handedBack: 0, offBalance: giving };
  const stillToPayFor = Math.max(0, roundMoney(orderNetTotal(order) - giving));
  const room = roundMoney((Number(paid) || 0) - moneyHandedBack(order) - stillToPayFor);
  const handedBack = Math.max(0, Math.min(giving, room));
  return { handedBack, offBalance: roundMoney(giving - handedBack) };
}

/**
 * Every return on an order, oldest first: money given back and goods replaced,
 * in one list, because to the customer they are two answers to the same
 * complaint. Both are written by the database (order_command), including who
 * handled them and when.
 */
export function returnHistory(order) {
  const refunds = (order?.refundHistory || []).map((entry) => ({
    ...entry, resolution: "refund", at: entry.refundedAt, handledBy: entry.refundedBy,
  }));
  const replacements = (order?.replacementHistory || []).map((entry) => ({
    ...entry, resolution: "replacement", at: entry.replacedAt,
  }));
  return [...refunds, ...replacements].sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}

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
  //
  // ZERO IS A REAL AGREED PRICE. The test used to be `stored > 0`, which read a
  // total corrected down to nothing as "there is no stored total" and quietly
  // billed the item sum instead -- so an order written off in full still showed,
  // and PRINTED, the original amount due. The price-correction dialog accepts 0
  // deliberately (asMoney floors there), so the dialog was right and this was
  // wrong.
  //
  // ABSENCE HAS TO BE SEPARATED FROM ZERO BEFORE COERCING, which is why this is
  // not simply `stored >= 0`: Number(null) is 0 and passes Number.isFinite, so
  // an order with no stored total at all would come back as costing nothing
  // rather than falling back to the lines -- a worse bug than the one being
  // fixed, and in the same direction.
  const raw = order?.totalAmount;
  const stored = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  // The loyalty reward is already taken off the stored total; it is returned so
  // the screen and the slip can say where the difference went.
  const discount = Number(order?.discountAmount) || 0;
  const total = Number.isFinite(stored) && stored >= 0 ? stored : Math.max(0, items + delivery - discount);
  const refunded = orderRefunded(order);
  return { items, delivery, discount, total, refunded, net: Math.max(0, total - refunded) };
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

/**
 * Whether an order can still be rewritten, and why not when it cannot.
 *
 * THE WINDOW IS "NOTHING HAS HAPPENED YET". An order that is still Waiting,
 * whose goods have not been taken off the shelf, that nobody has been refunded
 * for and whose price has never been corrected, is a printed sheet somebody
 * typed a few minutes ago. Rewriting it costs nothing and destroys no record.
 *
 * Every one of those conditions is the boundary of a record that WOULD be
 * destroyed:
 *
 *   status        a finished or cancelled order is history, not a draft.
 *   stock         once goods have left, the lines are the receipt for what
 *                 went; editing them would make the shelf count unexplainable.
 *   committed     the same thing per line, for an order that went out in part.
 *   refunds       a refund names lines and quantities. Change the lines and the
 *                 refund refers to something that never existed.
 *   corrections   a price correction records what the total WAS. Editing the
 *                 lines moves the total again with nothing recording it, which
 *                 is the exact hole price_adjustments was added to close.
 *
 * Returns a reason string when the answer is no, so the screen can say which of
 * these it hit rather than hiding the button and leaving somebody guessing.
 */
export function orderEditBlocker(order) {
  if (!order) return "That order is not here any more.";
  if (order.status === ORDER_STATUS.COMPLETED) {
    return "This order is finished. Put it back to waiting first, and only an administrator or a manager can do that.";
  }
  if (order.status === ORDER_STATUS.CANCELLED) {
    return "This order was called off, so there is nothing to change.";
  }
  if (order.stockCommittedAt) {
    return "Goods have already been taken off the shelf for this order.";
  }
  if (normalizeItems(order.items).some((line) => committedOf(line) > 0)) {
    return "Part of this order has already gone out, so the lines are a record of what went.";
  }
  if ((order.refundHistory || []).length > 0) {
    return "Money has already gone back on this order. Changing the lines would leave the refund naming things that were never on it.";
  }
  if ((order.priceAdjustments || []).length > 0) {
    return "The price on this order has already been corrected once, and that correction records what the old total was.";
  }
  return null;
}

/**
 * Why calling an order off, or putting a finished one back to waiting, would
 * be wrong right now -- or null. Both put what the order took off the shelf
 * back on it, which is only true of goods in the building. order_command
 * refuses the same two cases.
 */
export function callOffBlocker(order, deliveries = []) {
  const runs = deliveriesForOrder(order, deliveries);
  if (runs.some((run) => run.status === DELIVERY_STAGE.ON_THE_WAY)) {
    return "A delivery for this order is on the way. Mark it delivered, or mark that it came back, first.";
  }
  if (runs.some((run) => run.status === DELIVERY_STAGE.ARRIVED)) {
    return "Goods on this order have been delivered, so they are not on the shelf to put back. Give the money back instead, and say whether they came back.";
  }
  return null;
}

/** True when nothing has happened to this order yet. */
export const orderIsEditable = (order) => orderEditBlocker(order) === null;
