import { Toaster as Sonner, toast } from "sonner";

import { Check, Info, Warning } from "@/components/icons";

/**
 * Toasts, drawn to the Toasts board: bottom right, 5 seconds and paused on
 * hover. A --card panel with a 1px --border (--danger-bd-strong for an
 * error), 8px radius and shadow-menu; an 18px round status mark, a medium
 * title, a 13/18 muted description, and an outline action. They slide 16px
 * in from the right (lsb-toast).
 *
 * A toast says what happened and names the record ("Rosa Navarro can no
 * longer sign in"), so pass the subject, not just "Saved".
 */
const mark = "flex size-[18px] items-center justify-center rounded-full text-on-primary";

function Toaster(props) {
  return (
    <Sonner
      position="bottom-right"
      duration={5000}
      gap={10}
      icons={{
        success: <span className={`${mark} bg-success`}><Check className="size-[11px]" weight="bold" /></span>,
        error: <span className={`${mark} bg-danger text-xs font-semibold`}>!</span>,
        warning: <span className={`${mark} bg-warning`}><Warning className="size-[11px]" weight="bold" /></span>,
        info: <span className={`${mark} bg-strong-bg`}><Info className="size-[11px]" weight="bold" /></span>,
        loading: <span className="block size-[18px] animate-spin rounded-full border-2 border-border border-t-primary" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "lsb-toast flex w-[356px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-lg border border-border bg-card py-3 pl-3.5 pr-3 text-sm text-foreground shadow-menu",
          error: "border-danger-bd-strong",
          icon: "mt-px flex shrink-0",
          content: "min-w-0 flex-1",
          title: "font-medium",
          description: "text-13 text-muted-fg",
          actionButton:
            "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-card px-2.5 text-13 font-medium text-foreground hover:bg-muted",
          cancelButton:
            "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-card px-2.5 text-13 font-medium text-foreground hover:bg-muted",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
