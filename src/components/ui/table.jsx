import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Semantic table.
 *
 * The app had five table implementations: shared/ProfileTable (flex divs), three
 * ad-hoc CSS grids (UserAccountsPage, StaffDirectoryPage, StaffActivityLogPage)
 * that hand-repeated the same header and footer classes, and real <table>s in
 * the unrouted views/. The grids were not tables to a screen reader at all.
 *
 * Header type is standardised on the `text-[11px] tracking-[1.1px]` scale the
 * three grid tables used -- ProfileTable's near-identical
 * `text-[10.5px] tracking-[0.945px]` was the odd one out.
 *
 * Wrapped in an overflow-x container: the account and activity tables are wider
 * than a phone, and previously pushed the whole page sideways.
 */
const Table = forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
});

const TableHeader = forwardRef(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn("border-b border-[#17263a0f] bg-surface", className)}
      {...props}
    />
  );
});

const TableBody = forwardRef(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
});

const TableFooter = forwardRef(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-[#17263a0f] bg-surface text-sm text-muted",
        className
      )}
      {...props}
    />
  );
});

const TableRow = forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-[#17263a0f] transition hover:bg-[#17263a05] data-[state=selected]:bg-[#17263a08]",
        className
      )}
      {...props}
    />
  );
});

const TableHead = forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "px-7 py-3 text-left align-middle text-[11px] font-semibold uppercase tracking-[1.1px] text-muted",
        className
      )}
      {...props}
    />
  );
});

const TableCell = forwardRef(function TableCell({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn("px-7 py-4 align-middle text-ink", className)}
      {...props}
    />
  );
});

const TableCaption = forwardRef(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted", className)}
      {...props}
    />
  );
});

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
