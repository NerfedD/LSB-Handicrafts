import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Semantic table.
 *
 * The app had five table implementations: one built from flex divs, three
 * ad-hoc CSS grids that hand-repeated the same header and footer classes, and
 * real <table>s in the legacy workspace. The grids were not tables to a screen
 * reader at all — no row/column relationship, no header association.
 *
 * GEOMETRY IS THE HANDOFF'S, and it is doing work: 62px minimum rows with 15px
 * of vertical padding, a 14px-padded header band on paper-2, and 22px side
 * gutters. Rows that size are legible from a standing position at a counter,
 * which is where the products and orders lists are actually read.
 *
 * Header type is 13px uppercase at 0.07em — the one deliberate exception to
 * the 16px floor, alongside the sidebar's group labels. A tracked uppercase
 * column label is not read as a sentence; it is read as a signpost, once.
 *
 * Wrapped in an overflow-x container so a wide table scrolls inside its own
 * card rather than pushing the whole page sideways. On a phone these lists
 * become cards instead — see the `<834px` branch on each list screen. Nothing
 * in this system is ever a horizontal scroll on a phone.
 */
const Table = forwardRef(function Table({ className, minWidth = 860, ...props }, ref) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        ref={ref}
        style={{ minWidth }}
        className={cn("w-full caption-bottom border-collapse text-left", className)}
        {...props}
      />
    </div>
  );
});

const TableHeader = forwardRef(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn(
        "border-b border-card bg-paper-2",
        className
      )}
      {...props}
    />
  );
});

const TableBody = forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
});

const TableRow = forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-hair transition duration-150",
        "hover:bg-wash-2",
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
      scope="col"
      className={cn(
        "px-5.5 py-3.5 align-middle text-[13px] font-extrabold uppercase tracking-[0.07em] text-muted",
        className
      )}
      {...props}
    />
  );
});

/** 15px vertical padding on a 62px minimum row. */
const TableCell = forwardRef(function TableCell({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        "h-15.5 px-5.5 py-3.5 align-middle text-[16px] text-ink",
        className
      )}
      {...props}
    />
  );
});

const TableCaption = forwardRef(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn("sr-only", className)} {...props} />;
});

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };
