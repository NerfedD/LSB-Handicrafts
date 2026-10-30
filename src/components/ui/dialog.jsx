import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { X } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Dialog on Base UI, drawn to the *Dialog boards.
 *
 * The panel sits 64px from the top, centred, on an --overlay backdrop: 8px
 * radius, 1px --border, --card, shadow-dialog. Header 20px in (52px on the
 * right to clear the 28px close button), title 16/24 semibold, description
 * 13/18 muted. Body 16px/20px with 14px between fields. Footer right-aligned,
 * 8px apart, 20px padding: Cancel (outline) then the one primary.
 *
 * The panel pops in (lsb-pop) and the backdrop fades (lsb-fade).
 */
const SIZES = {
  sm: "w-[440px]",
  default: "w-[480px]",
  md: "w-[520px]",
  lg: "w-[560px]",
  xl: "w-[640px]",
};

function Dialog(props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("lsb-fade fixed inset-0 z-50 bg-overlay data-[ending-style]:opacity-0", className)}
      {...props}
    />
  );
}

function DialogContent({ className, children, size = "default", showClose = true, closeLabel = "Close", ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-16">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "lsb-pop relative max-w-full rounded-lg border border-border bg-card text-sm text-foreground shadow-dialog outline-none",
            "data-[ending-style]:opacity-0",
            SIZES[size] ?? SIZES.default,
            className
          )}
          {...props}
        >
          {children}
          {showClose ? (
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-muted-fg hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }) {
  return <div data-slot="dialog-header" className={cn("px-5 pr-[52px] pt-5", className)} {...props} />;
}

function DialogBody({ className, ...props }) {
  return <div data-slot="dialog-body" className={cn("flex flex-col gap-3.5 px-5 py-4", className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return (
    <div data-slot="dialog-footer" className={cn("flex flex-wrap justify-end gap-2 px-5 pb-5", className)} {...props} />
  );
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("m-0 text-base font-semibold leading-6", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("m-0 mt-0.5 text-13 text-muted-fg", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
