import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rankProductSales, SALES_PERIODS } from "../../utils/productSales";
import { CalendarBlank, CaretDown } from "../icons";
import { EmptyState, SectionCard } from "./page";
import { LoadingState } from "./PageStates";

const TITLE = "Top-selling products";
const LIMIT = 5;

export function SalesPeriodMenu({ period, onChange, label }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" aria-label={label ? `${label}, ${period.label}` : undefined} />}>
        <CalendarBlank aria-hidden="true" />
        {period.label}
        <CaretDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={period.value} onValueChange={onChange}>
          {SALES_PERIODS.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TopSellingProducts({ orders, inventory, period, now, history, action, className }) {
  const loading = !history.isLoaded || (period.days === 365 && !history.settled);
  const unavailable = loading || Boolean(history.error);
  const rows = useMemo(() => {
    if (unavailable) return [];
    return rankProductSales(orders, inventory, period.days, now).slice(0, LIMIT);
  }, [orders, inventory, period.days, now, unavailable]);
  const most = rows[0]?.quantity ?? 1;

  return (
    <SectionCard
      role="region"
      aria-label={TITLE}
      title={TITLE}
      description={`Units sold on completed orders placed in the ${period.label.toLowerCase()}, after item refunds.`}
      className={className}
      action={action}
    >
      {history.error ? (
        <EmptyState
          title="Sales could not be loaded"
          description="Refresh the orders to try again."
          action={<Button variant="outline" onClick={history.reload}>Try again</Button>}
          className="py-8"
        />
      ) : loading ? (
        <LoadingState noun="product sales" rows={3} bare />
      ) : rows.length === 0 ? (
        <EmptyState title="No sales in this period" description="Products appear here when their orders are completed." className="py-8" />
      ) : (
        <ol className="m-0 list-none p-0">
          {rows.map(({ key, name, code, quantity }, index) => (
            <li key={key} className="border-t border-row-divider px-4 py-2 text-13">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words font-medium">
                  {index + 1}. {name}{code ? <> <span className="ml-1 whitespace-nowrap text-xs font-normal text-muted-fg">{code}</span></> : null}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-fg-2">{quantity.toLocaleString("en-US")} sold</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(quantity / most) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
