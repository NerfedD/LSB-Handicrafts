import { cn } from "@/lib/utils";

/**
 * The scaffolding every list screen shares.
 *
 * Products, orders, customers, suppliers and staff all have the same anatomy —
 * a filter row, a counted chip row, the records, a footer — and putting that
 * anatomy here is what makes learning one screen teach you the others. The
 * handoff is explicit about it for suppliers ("uses the same layout vocabulary
 * so learning one teaches the other"), and it holds for all five.
 */

/** Search plus dropdowns, wrapping at 12px gaps. */
export function FilterBar({ children, className }) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

/**
 * The phone's sticky primary action.
 *
 * Below 834px the header's primary button is gone — there is no room beside the
 * title for it — so it comes back as a bar pinned above the tab bar. Pinned
 * rather than at the bottom of the list, because a list of 148 products puts
 * "Add a product" 148 rows away.
 */
export function StickyCta({ children, className }) {
  return (
    <div
      className={cn(
        "pb-safe fixed inset-x-0 bottom-14 z-30 border-t border-card bg-surface/95 px-4 py-3 backdrop-blur tab:hidden",
        
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * One record as a card, for phone width.
 *
 * "Table rows become cards. Nothing is ever a horizontal scroll." A five-column
 * table at 390px is either unreadably narrow columns or a sideways scroll that
 * hides two of them, and both are worse than restacking.
 */
export function RecordCard({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-card border border-card bg-surface p-4 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}
