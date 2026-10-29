import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CaretLeft, CaretRight, MagnifyingGlass } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The page sections every view is built from, drawn to the boards:
 *
 *   Page → PageHeader → StatCards (where shown) → FilterBar → DataTable or
 *   board → EmptyState
 *
 * One primary CTA per view, in the PageHeader's actions.
 */

/** The inset's content column: 16px in, 16px between sections, each rising in once. */
export function Page({ className, ...props }) {
  return <div className={cn("lsb-page flex flex-col gap-4 p-4", className)} {...props} />;
}

/**
 * A 20px icon in a 36px bordered box, the 20/28 page title and a 13/18 muted
 * description, with the actions on the right. `back` draws the detail
 * screens' "Back to …" link above it.
 */
export function PageHeader({ icon: Icon, title, description, actions, back, children, className }) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="inline-flex w-fit items-center gap-1 text-13 font-medium text-muted-fg hover:text-foreground"
        >
          <CaretLeft className="size-4" aria-hidden="true" />
          {back.label}
        </button>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-fg-2 shadow-xs">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-semibold tracking-[-0.01em]">{title}</h1>
            {description ? <p className="m-0 text-13 text-muted-fg">{description}</p> : null}
            {children}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** An auto-fit grid of StatCards. */
export function StatCards({ label, min = 200, className, ...props }) {
  return (
    <section
      aria-label={label}
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}
      {...props}
    />
  );
}

/**
 * Two shapes, as the boards draw them.
 *
 *   full     (Dashboard) 16px in: label and 16px icon, a 24/32 figure, then a
 *            badge and a muted caption.
 *   compact  (list screens) 12px by 16px: label, then a 20/28 figure with a
 *            12px muted caption beside it.
 */
export function StatCard({ label, icon: Icon, value, unit, badge, caption, compact = false, className, onClick }) {
  const Comp = onClick ? "button" : "div";
  if (compact) {
    return (
      <Comp
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={cn("rounded-lg border border-border bg-card px-4 py-3 text-left shadow-xs", onClick && "hover:bg-surface-2", className)}
      >
        <div className="text-13 font-medium text-muted-fg">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-xl font-semibold">{value}</span>
          {caption ? <span className="text-xs text-muted-fg">{caption}</span> : null}
        </div>
      </Comp>
    );
  }
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left shadow-xs", onClick && "hover:bg-surface-2", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-13 font-medium text-muted-fg">{label}</span>
        {Icon ? <Icon className="size-4 text-muted-fg" aria-hidden="true" /> : null}
      </div>
      <div className="text-2xl font-semibold tracking-[-0.02em]">
        {value}
        {unit ? <span className="text-sm font-normal tracking-normal text-muted-fg"> {unit}</span> : null}
      </div>
      {badge || caption ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-fg">
          {badge}
          {caption}
        </div>
      ) : null}
    </Comp>
  );
}

/** The card a FilterBar and its DataTable sit in. */
export function DataCard({ label, className, ...props }) {
  return <section aria-label={label} className={cn("rounded-lg border border-border bg-card shadow-xs", className)} {...props} />;
}

/** Search, filters, bulk actions on the right, 12px in, ruled off from the table. */
export function FilterBar({ className, ...props }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-border p-3", className)} {...props} />;
}

/** Pushes what follows it in a FilterBar to the right. */
export function FilterSpacer() {
  return <div className="flex-[1_1_0]" />;
}

/** The table search: a 16px MagnifyingGlass inside a 32px field, 13px text. */
export function SearchField({ label, value, onChange, placeholder, className, inputRef, ...props }) {
  const id = useId();
  return (
    <div className={cn("relative min-w-[180px] flex-[0_1_260px]", className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-fg" aria-hidden="true" />
      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="lsb-field h-8 w-full rounded-md border border-border bg-card pl-8 pr-2.5 text-13 text-foreground shadow-xs placeholder:text-muted-2"
        {...props}
      />
    </div>
  );
}

/**
 * A filter select: "Role  All ▾" — the field name muted, the value medium.
 * `options` is [{ value, label }]. `dashed` is the faceted filter that has
 * no value yet.
 */
export function FilterSelect({ label, value, options, onChange, className, dashed = false, icon: Icon }) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Select value={value} onValueChange={(next) => onChange(next)} items={items}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-8 gap-1.5 text-13", dashed && "border-dashed shadow-none", className)}
      >
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
        <span className="text-muted-fg">{label}</span>
        <SelectPrimitive.Value className="font-medium" />
      </SelectTrigger>
      <SelectContent className="min-w-[200px] text-13">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="h-[30px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Selected rows: "3 selected", the bulk actions as 28px outline buttons, then Clear. */
export function BulkActions({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-13 text-fg-2">{count} selected</span>
      {children}
      <Button variant="ghost" size="sm" className="px-2 text-fg-2" onClick={onClear}>Clear</Button>
    </div>
  );
}

/**
 * Icon in a 40px bordered box, a 14/20 title, one 13px line of help, and one
 * outline button (usually "Clear filters").
 */
export function EmptyState({ icon: Icon, title, description, action, className, children }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}>
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-fg">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="m-0 mt-1 text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="m-0 max-w-md text-13 text-muted-fg">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
      {children}
    </div>
  );
}

/**
 * The DataTable footer: a count on the left; rows per page, "Page 1 of 5"
 * and 28px previous / next on the right.
 */
export function TablePagination({ summary, page, pageCount, onPage, pageSize, pageSizes = [10, 20, 50], onPageSize }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-13 text-muted-fg">
      <span>{summary}</span>
      <div className="flex flex-wrap items-center gap-4">
        {onPageSize ? (
          <span className="inline-flex items-center gap-2">
            Rows per page
            <Select value={String(pageSize)} onValueChange={(next) => onPageSize(Number(next))}>
              <SelectTrigger size="sm" aria-label="Rows per page" className="w-auto gap-1 pl-2 pr-1.5 shadow-none">
                <SelectPrimitive.Value />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        ) : null}
        <span className="font-medium text-foreground">Page {page} of {Math.max(1, pageCount)}</span>
        <span className="inline-flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <CaretLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <CaretRight />
          </Button>
        </span>
      </div>
    </div>
  );
}

/** A titled card section: the board's "Stock to watch", "Recent activity" and the like. */
export function SectionCard({ title, description, action, footer, className, bodyClassName, children, ...props }) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-semibold">{title}</h2>
          {description ? <p className="m-0 text-13 text-muted-fg">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-border px-4 py-2.5">{footer}</div> : null}
    </Card>
  );
}

/** A label and its value, as the detail boards list facts: 13px muted over 14px. */
export function Fact({ label, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-13 text-muted-fg">{label}</dt>
      <dd className="m-0 mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** A text link, the one blue run of text the boards allow. */
export function TextLink({ className, children, ...props }) {
  return (
    <button
      type="button"
      data-slot="text-link"
      className={cn("inline-flex items-center gap-1 text-13 font-medium text-primary-text hover:underline", className)}
      {...props}
    >
      {children}
    </button>
  );
}
