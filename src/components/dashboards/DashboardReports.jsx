import { useMemo } from "react";

import { EmptyState, SectionCard } from "../shared/page";
import { cn } from "@/lib/utils";
import { shelfItems } from "../../utils/productStock";

const BARS = 8;

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
