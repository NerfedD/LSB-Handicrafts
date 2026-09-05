/**
 * What the dashboards say.
 *
 * The "needs your attention" card is the centrepiece of every standard
 * dashboard and the handoff calls it the screen's teaching mechanism: a new
 * user learns what this system is FOR by reading three sentences about their
 * own day, each with one button whose label is a verb.
 *
 * That only works if the sentences are TRUE, so all of this is derived from the
 * live data rather than being a fixed list of links dressed up as prose. It
 * also means the card can be empty, and an empty attention card is the best
 * possible state — so it says so plainly rather than inventing filler.
 *
 * PRIORITY, NOT COMPLETENESS. Each dashboard shows at most three. Somebody who
 * opens a dashboard to nine equally-weighted problems has not been helped, and
 * the ordering below is the judgement being made: things that stop work today
 * come before things that will matter next week.
 */

import { ORDER_STATUS } from "./constants";
import { isLate } from "./deliveries";
import { backorderDemand, daysWaiting } from "./orders";
import { lowStockProducts, shelfItems } from "./productStock";
import { signInState } from "./copy";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything the admin / manager dashboard might raise, most urgent first.
 *
 * `icon` and `actionIcon` are names resolved by the dashboard component — this
 * module stays free of React so the same shapes can be tested and reused.
 */
export function attentionFor({ role, products, inventory, orders, deliveries, staff }) {
  const items = [];

  const low = lowStockProducts(products, inventory, orders);
  const out = low.filter(({ stock }) => stock.isOut);
  const waiting = orders.filter((order) => order.status === ORDER_STATUS.PENDING);
  const stale = waiting.filter((order) => (daysWaiting(order) ?? 0) >= 3);
  const late = deliveries.filter(isLate);
  const lockedOut = staff.filter((person) => signInState(person).label !== "Yes");

  // Nothing on the shelf stops work today, so it leads.
  if (out.length > 0) {
    items.push({
      key: "out",
      tone: "red",
      icon: "PackageOpen",
      title:
        out.length === 1
          ? `${out[0].product.name} has run out`
          : `${plural(out.length, "product has", "products have")} run out`,
      body:
        "There is nothing left to sell, and any order for these cannot be filled until more is made.",
      actionLabel: "Make these first",
      actionIcon: "Hammer",
      target: { view: "products", filter: "out" },
    });
  }

  if (late.length > 0) {
    items.push({
      key: "late",
      tone: "red",
      icon: "Truck",
      title: `${plural(late.length, "delivery is", "deliveries are")} past the day promised`,
      body: "Somebody is expecting these and has not been told anything. The board shows where each one is stuck.",
      actionLabel: "Open the board",
      actionIcon: "Truck",
      target: { view: "deliveries", filter: "late" },
    });
  }

  if (stale.length > 0) {
    items.push({
      key: "stale-orders",
      tone: "amber",
      icon: "ClipboardList",
      title: `${plural(stale.length, "order has", "orders have")} been waiting three days or more`,
      body: "Nothing is wrong with them — they simply have not moved. Opening one shows what it is waiting on.",
      actionLabel: "Open these orders",
      actionIcon: "ArrowRight",
      target: { view: "orders", filter: "waiting" },
    });
  }

  const runningLow = low.filter(({ stock }) => !stock.isOut);
  if (runningLow.length > 0) {
    items.push({
      key: "low",
      tone: "amber",
      icon: "Boxes",
      title: `${plural(runningLow.length, "product is", "products are")} running low`,
      body: "Still sellable, but below the level you asked to be warned at. Making more now avoids running out.",
      actionLabel: "Restock these",
      actionIcon: "PackagePlus",
      target: { view: "products", filter: "low" },
    });
  }

  // Only an administrator can do anything about an account, so only an
  // administrator is told about one. Raising a problem with somebody who cannot
  // act on it is how people learn to skim the card.
  if (role === "Admin" && lockedOut.length > 0) {
    items.push({
      key: "accounts",
      tone: "cobalt",
      icon: "UserX",
      title:
        lockedOut.length === 1
          ? `${lockedOut[0].name} cannot sign in`
          : `${plural(lockedOut.length, "person", "people")} cannot sign in`,
      body:
        "Either the account is blocked, or nobody has said what they do yet. Both are a one-minute fix.",
      actionLabel: "Review the account",
      actionIcon: "UserCog",
      target: { view: "staff", filter: "blocked" },
    });
  }

  if (waiting.length > 0 && stale.length === 0 && items.length < 3) {
    items.push({
      key: "waiting",
      tone: "cobalt",
      icon: "ClipboardList",
      title: `${plural(waiting.length, "order is", "orders are")} still waiting`,
      body: "Nothing is overdue. This is simply what is in the queue today.",
      actionLabel: "Open these orders",
      actionIcon: "ArrowRight",
      target: { view: "orders", filter: "waiting" },
    });
  }

  return items.slice(0, 3);
}

/** The sales dashboard's "Your follow-ups" — the same shape, a different job. */
export function followUpsFor({ orders, customerRows }) {
  const items = [];

  const waiting = orders.filter((order) => order.status === ORDER_STATUS.PENDING);
  const stale = waiting.filter((order) => (daysWaiting(order) ?? 0) >= 3);
  const lapsed = customerRows.filter(({ summary }) => summary.isLapsed);
  const newThisMonth = customerRows.filter(({ summary }) => summary.isNewThisMonth);

  if (stale.length > 0) {
    items.push({
      key: "stale-orders",
      tone: "amber",
      icon: "ClipboardList",
      title: `${plural(stale.length, "order has", "orders have")} been waiting three days or more`,
      body: "Worth a call to say where things stand, even if nothing has changed.",
      actionLabel: "Open these orders",
      actionIcon: "ArrowRight",
      target: { view: "orders", filter: "waiting" },
    });
  }

  if (lapsed.length > 0) {
    items.push({
      key: "lapsed",
      tone: "clay",
      icon: "Phone",
      title: `${plural(lapsed.length, "customer has", "customers have")} not ordered in a year`,
      body: "They bought from us once and have not come back. This is a call list, not a filter.",
      actionLabel: "See who to ring",
      actionIcon: "ArrowRight",
      target: { view: "customers", filter: "lapsed" },
    });
  }

  if (waiting.length > 0 && stale.length === 0) {
    items.push({
      key: "waiting",
      tone: "cobalt",
      icon: "ClipboardList",
      title: `${plural(waiting.length, "order is", "orders are")} in the queue`,
      body: "Nothing is overdue. This is what is being worked on today.",
      actionLabel: "Open these orders",
      actionIcon: "ArrowRight",
      target: { view: "orders", filter: "waiting" },
    });
  }

  if (newThisMonth.length > 0 && items.length < 3) {
    items.push({
      key: "new",
      tone: "green",
      icon: "UserPlus",
      title: `${plural(newThisMonth.length, "new customer", "new customers")} this month`,
      body: "Worth checking their first order went smoothly — it is what decides whether there is a second.",
      actionLabel: "See who is new",
      actionIcon: "ArrowRight",
      target: { view: "customers", filter: "new" },
    });
  }

  return items.slice(0, 3);
}

/**
 * The production dashboard's make list: what to make next, most urgent first.
 *
 * `needed` is the shortfall against the warn level, not a guess at demand — it
 * is the number that would take the shelf back to where somebody said it should
 * be. That makes it checkable, which a forecast would not be.
 */
export function makeList({ products, inventory, orders }) {
  const owed = backorderDemand(orders);
  const rows = lowStockProducts(products, inventory, orders).map(({ product, stock }) => ({
    product,
    stock,
    backorder: false,
    onShelf: stock.available,
    needed: Math.max(1, stock.threshold - stock.available),
    urgency: stock.isOut ? "Run out" : "Running low",
    tone: stock.isOut ? "red" : "amber",
  }));

  if (owed.size === 0) return rows;

  // backorderDemand is keyed by inventory row id; the make list is a list of
  // CATALOG products. The two line up on code — inventory.sku is
  // products.itemCode — which is the join utils/productStock owns, so the walk
  // goes through it rather than matching the strings a fourth time.
  const codeOf = new Map(
    inventory.map((row) => [row.id, String(row.sku || "").toLowerCase()])
  );
  const shelf = shelfItems(products, inventory, orders);

  const promoted = [];
  const rest = [];
  const claimed = new Set();

  for (const [productId, units] of owed) {
    const code = codeOf.get(productId);
    const entry = shelf.find(
      ({ product }) => String(product.itemCode || "").toLowerCase() === code
    );
    // No catalog entry for a stocked row is a real state, and inventing a row
    // for it would put a nameless line at the top of the list.
    if (!entry) continue;
    claimed.add(entry.product.id);
    promoted.push({
      product: entry.product,
      stock: entry.stock,
      backorder: true,
      onShelf: entry.stock.tracked ? entry.stock.available : 0,
      needed: units,
      urgency: "Owed to a customer",
      tone: "red",
    });
  }

  for (const row of rows) {
    if (!claimed.has(row.product.id)) rest.push(row);
  }

  // Most owed first within the promoted group, then the ordinary shortfall list
  // in the order productStock already sorted it.
  promoted.sort((a, b) => b.needed - a.needed);
  return [...promoted, ...rest];
}

/** Money taken this calendar month, across orders that were not cancelled. */
export function takenThisMonth(orders = []) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  return orders
    .filter((order) => order.status !== ORDER_STATUS.CANCELLED)
    .filter((order) => {
      const at = order.createdAt ? new Date(order.createdAt).getTime() : null;
      return at !== null && !Number.isNaN(at) && at >= start.getTime();
    })
    .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
}

/**
 * The one-line summary under the greeting.
 *
 * "Three things need you today. Everything else is running normally." is the
 * question somebody opens a dashboard with — settle in, or carry on — and
 * answering it in one line is worth more than any of the numbers below it.
 */
export function daySummary(attentionCount) {
  if (attentionCount === 0) {
    return "Nothing needs you right now. Everything is running normally.";
  }
  return `${attentionCount === 1 ? "One thing needs" : `${attentionCount} things need`} you today. Everything else is running normally.`;
}
