import { LINE_KIND, ORDER_STATUS } from "./constants";
import { committedOf, orderedOf, stockLines, voidedOf } from "./stockLedger";

export const DAY_MS = 86_400_000;
export const SALES_PERIODS = [
  { value: "7", label: "Past week", days: 7, compare: "the week before" },
  { value: "30", label: "Past month", days: 30, compare: "the month before" },
  { value: "365", label: "Past year", days: 365, compare: "the year before" },
];

/** Rank completed sales by the date the order was placed. */
export function rankProductSales(orders, inventory, days, now) {
  const since = now - days * DAY_MS;
  const stockById = new Map(inventory.map((row) => [String(row.id), row]));
  const totals = new Map();

  for (const order of orders) {
    if (order.status !== ORDER_STATUS.COMPLETED) continue;
    const placedAt = Date.parse(order.createdAt);
    if (!(placedAt >= since && placedAt <= now)) continue;

    for (const line of stockLines(order)) {
      const label = line.name?.trim();
      const stockUnits = orderedOf(line);
      // Older orders can lack line counters. The voided count still records
      // itemized refunds, and stockLines already resolves old commitment stamps.
      const kept = line.committedUnits == null
        ? stockUnits - voidedOf(line)
        : committedOf(line);
      // Cut lines can sell several pieces from one parent sheet.
      const quantity = stockUnits > 0
        ? Math.round(line.quantity * Math.min(stockUnits, kept) / stockUnits)
        : line.quantity;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      // Catalogue and negotiated lines share the stock ID even after a rename.
      // Cut-to-size and custom items are identified by their order-line names.
      const stockId = line.kind !== LINE_KIND.CUT && line.productId != null ? String(line.productId) : null;
      const stock = stockById.get(stockId);
      const name = stock?.name || label;
      if (!name) continue;
      const key = stockId === null ? `${line.kind}:${name.toLowerCase()}` : `stock:${stockId}`;
      const row = totals.get(key) ?? { key, name, code: stock?.sku, quantity: 0 };
      row.quantity += quantity;
      totals.set(key, row);
    }
  }

  return [...totals.values()].sort((a, b) => b.quantity - a.quantity
    || a.name.localeCompare(b.name)
    || a.key.localeCompare(b.key));
}
