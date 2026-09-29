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
 * The filters with the screen's primary action at the end of the same row.
 *
 * The action used to live in the header, above the title, where people did not
 * look for it. Here it sits beside the search that starts every task on the
 * screen. Below 834px it gives way to StickyCta, which is pinned where a thumb
 * reaches it; `action` is rendered from 834px up only.
 */
export function ListToolbar({ children, action, className }) {
  return (
    <div className={cn("flex flex-col gap-3 tab:flex-row tab:items-start tab:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      {action && <div className="hidden shrink-0 flex-wrap justify-end gap-2.5 tab:flex">{action}</div>}
    </div>
  );
}

/**
 * The phone's sticky primary action.
 *
 * Below 834px there is no room beside the filters for the primary button, so
 * it comes back as a bar pinned above the tab bar. Pinned rather than at the
 * bottom of the list, because a list of 148 products puts "Add a product" 148
 * rows away.
 */
export function StickyCta({ children, className }) {
  return (
    <div
      className={cn(
        // Solid, not blurred: a blur behind a fixed bar is recomputed on every
        // scroll frame, and at 95% opacity it was barely visible anyway.
        "pb-safe fixed inset-x-0 bottom-14 z-30 border-t border-card bg-surface px-4 py-3 tab:hidden",
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
        // `relative` so the entry-landing overlay has somewhere to sit. It is
        // here rather than at the four call sites because a card that forgets
        // it does not fail loudly — the wash paints over whatever ancestor IS
        // positioned, which on a phone is most of the screen.
        "relative rounded-card border border-card bg-surface p-4 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}
