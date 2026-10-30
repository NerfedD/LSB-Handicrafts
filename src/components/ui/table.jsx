import { cn } from "@/lib/utils";

/**
 * shadcn/ui Table, drawn to the DataTable on the boards: 13/18 text, 36px
 * header and body rows, a --border line under the header and a
 * --row-divider between rows. The first and last columns sit 16px in, the
 * rest 8px. Rows tint on hover (index.css).
 *
 * The table scrolls sideways inside its card rather than squeezing columns:
 * `minWidth` is the narrowest the columns read at.
 */
function Table({ className, minWidth = 760, containerClassName, ...props }) {
  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-x-auto", containerClassName)}>
      <table
        data-slot="table"
        style={{ minWidth }}
        className={cn("w-full caption-bottom border-collapse text-13", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn("h-9 border-b border-row-divider data-[state=selected]:bg-surface-2", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-9 whitespace-nowrap px-2 text-left align-middle font-medium text-muted-fg first:pl-4 last:pr-4",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("whitespace-nowrap px-2 align-middle first:pl-4 last:pr-4", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }) {
  return <caption data-slot="table-caption" className={cn("mt-3 text-13 text-muted-fg", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };
