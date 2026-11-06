import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Sheet on Base UI (a side-anchored Dialog). The sidebar opens as
 * one below 768px: --surface-2 with a right --border and shadow-dialog,
 * sliding in from the left over the --overlay backdrop.
 */
function Sheet(props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({ className, children, side = "left", ...props }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="lsb-fade fixed inset-0 z-40 bg-overlay" />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "lsb-sheet fixed inset-y-0 z-40 flex flex-col bg-sidebar shadow-dialog outline-none",
          side === "left" ? "left-0 border-r border-border" : "right-0 border-l border-border",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }) {
  return <SheetPrimitive.Title className={cn("sr-only", className)} {...props} />;
}

export { Sheet, SheetContent, SheetTitle };
