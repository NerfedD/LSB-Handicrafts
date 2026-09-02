import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { X } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Modal shell.
 *
 * The overlay and panel styling below is lifted verbatim from the two modals
 * this replaces -- DeleteAccountModal in UserAccountsPage and BlockAccountModal
 * in ManageUserAccountPage, which were byte-for-byte identical apart from their
 * strings and confirm colour. Same scrim (#111e3273), same radius, same shadow,
 * same max-width, so both screens look exactly as they did.
 *
 * What is new is behavioural, and comes free with Radix: focus is trapped and
 * restored, Escape closes, the trigger is re-focused on close, and the rest of
 * the page is hidden from screen readers. The hand-rolled versions did none of
 * that.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef(function DialogOverlay(
  { className, ...props },
  ref
) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-[#111e3273] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

const DialogContent = forwardRef(function DialogContent(
  { className, children, showClose = true, ...props },
  ref
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl bg-white px-12 py-11 text-center",
          "shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted transition hover:bg-[#17263a08] focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }) {
  return <div className={cn("flex gap-3 pt-2", className)} {...props} />;
}

const DialogTitle = forwardRef(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-lg font-semibold text-ink", className)}
      {...props}
    />
  );
});

const DialogDescription = forwardRef(function DialogDescription(
  { className, ...props },
  ref
) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
});

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
