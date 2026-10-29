import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui AlertDialog on Base UI, drawn to the ConfirmDialog board: 440px,
 * a 32px round tinted icon beside a 16/24 title and a 13/18 --fg-2 body,
 * then the keep and act buttons on the right, 20px in.
 */
function AlertDialog(props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger(props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogClose(props) {
  return <AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />;
}

function AlertDialogContent({ className, children, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="lsb-fade fixed inset-0 z-50 bg-overlay" />
      <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-16">
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          className={cn(
            "lsb-pop relative w-[440px] max-w-full rounded-lg border border-border bg-card text-sm text-foreground shadow-dialog outline-none",
            className
          )}
          {...props}
        >
          {children}
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Viewport>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({ className, ...props }) {
  return <AlertDialogPrimitive.Title className={cn("m-0 text-base font-semibold leading-6", className)} {...props} />;
}

function AlertDialogDescription({ className, ...props }) {
  return <AlertDialogPrimitive.Description className={cn("m-0 mt-1 text-13 text-fg-2", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }) {
  return <div className={cn("flex flex-wrap justify-end gap-2 p-5", className)} {...props} />;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
};
