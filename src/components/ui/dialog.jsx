import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { X } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Modal shell.
 *
 * 18px radius, the handoff's modal shadow, and a header/body/footer split —
 * because every dialog in the design has the same three parts: a title with a
 * subhead, a single column of content, and a footer band carrying exactly two
 * buttons.
 *
 * THE CLOSE CONTROL IS 44px AND OUTLINED, not a 16px grey X in the corner. It
 * is the one place an icon appears without a word beside it, and it earns that
 * exemption by being a dismiss affordance in a fixed, conventional position —
 * so it is given a real tap target instead of being made small to compensate.
 *
 * Focus trapping, Escape-to-close, trigger restoration and hiding the rest of
 * the page from screen readers all come from Radix underneath. The hand-rolled
 * modals this replaced did none of that.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-[#111d2b7a] backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

const DialogContent = forwardRef(function DialogContent(
  { className, children, showClose = true, closeLabel = "Close", ...props },
  ref
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col",
          "overflow-hidden rounded-modal2 border border-card bg-surface text-left shadow-modal",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close asChild>
            <Button variant="outline" size="icon" className="absolute right-5 top-5">
              <X className="h-5 w-5" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

/**
 * Title over subhead, with the close button's 44px reserved on the right so a
 * long title never runs under it.
 */
function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-hair2 px-6.5 py-5.5 pr-19",
        className
      )}
      {...props}
    />
  );
}

/** The scrolling middle. A single column, per rule 5 — one question at a time. */
function DialogBody({ className, ...props }) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-6.5 py-6", className)}
      {...props}
    />
  );
}

/**
 * The footer band. Two buttons, the dismissing one on the left and the
 * committing one on the right, on paper-2 so it reads as a separate register
 * from the content above it.
 */
function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-hair2 bg-paper-2 px-6.5 py-5",
        className
      )}
      {...props}
    />
  );
}

const DialogTitle = forwardRef(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink",
        className
      )}
      {...props}
    />
  );
});

const DialogDescription = forwardRef(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("pt-1 text-[15px] leading-[1.5] text-muted", className)}
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
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
