import { useMemo } from "react";

import { EmptyState, SectionCard } from "../shared/page";
import { cn } from "@/lib/utils";
import { normalizeItems } from "../../utils/orderItems";
import { shelfItems } from "../../utils/productStock";
import { formatPeso } from "../../utils/profileFormat";

const TOP = 5;
const BARS = 8;

/** The best-selling items in the chosen period, by pieces ordered. */
export function TopSellers({ orders, periodLabel }) {
  const rows = useMemo(() => {
    const byName = new Map();
    for (const order of orders) {
      for (const item of normalizeItems(order.items)) {
        if (!item.name || item.quantity <= 0) continue;
        const entry = byName.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0, orders: 0 };
        entry.quantity += item.quantity;
        entry.revenue += item.lineTotal;
        entry.orders += 1;
        byName.set(item.name, entry);
      }
    }
    return [...byName.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, TOP);
  }, [orders]);
  const most = Math.max(1, ...rows.map((r) => r.quantity));

  return (
    <SectionCard className="min-w-0 flex-[1_1_320px]" title="Top-selling items" description={`Most pieces ordered, ${periodLabel}`}>
      {rows.length === 0 ? (
        <EmptyState title="No sales yet" description="Nothing was ordered in this period." className="py-8" />
      ) : (
        <ol className="m-0 list-none p-0">
          {rows.map((row, i) => (
            <li key={row.name} className="border-t border-row-divider px-4 py-2 text-13">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{i + 1}. {row.name}</span>
                <span className="whitespace-nowrap tabular-nums text-fg-2">{row.quantity} pcs · {formatPeso(row.revenue)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(row.quantity / most) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

/** Products on the shelf against their reorder level, lowest first. */
export function StockLevels({ products, inventory }) {
  const rows = useMemo(() => shelfItems(products, inventory)
    .filter(({ stock }) => stock.tracked)
    .map(({ product, stock }) => ({ id: product.id, name: product.name, ...stock }))
    .sort((a, b) => a.available / Math.max(1, a.threshold) - b.available / Math.max(1, b.threshold))
    .slice(0, BARS), [products, inventory]);

  return (
    <SectionCard className="min-w-0 flex-[1_1_320px]" title="Stock levels" description="Available on the shelf; the line marks the reorder level">
      {rows.length === 0 ? (
        <EmptyState title="No stock tracked" description="Products appear here once they have a stock count." className="py-8" />
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => {
            const scale = Math.max(row.ceiling, row.available, row.threshold, 1);
            const tone = row.isOut ? "bg-danger" : row.isLow ? "bg-warning" : "bg-success";
            return (
              <li key={row.id} className="border-t border-row-divider px-4 py-2 text-13">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{row.name}</span>
                  <span className="whitespace-nowrap tabular-nums text-fg-2">{Math.max(0, row.available)} / reorder at {row.threshold}</span>
                </div>
                <div
                  className="relative mt-1 h-2 rounded-full bg-muted"
                  role="img"
                  aria-label={`${row.name}: ${Math.max(0, row.available)} available, reorder at ${row.threshold}`}
                >
                  <div className={cn("h-full rounded-full", tone)} style={{ width: `${(Math.max(0, row.available) / scale) * 100}%` }} />
                  <span className="absolute -top-0.5 h-3 w-px bg-foreground" style={{ left: `${(row.threshold / scale) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
