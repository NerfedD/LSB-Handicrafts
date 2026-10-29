import { forwardRef } from "react";

import { CaretUpDown } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui NativeSelect: the browser's own <select>, drawn exactly like the
 * Select trigger on the dialog boards (32px, --border, --card, shadow-xs, a
 * CaretUpDown on the right).
 *
 * Used for form fields inside dialogs and forms, where the native control is
 * the better tool: it works with the phone's own picker, with autofill, and
 * with a plain <form> submit. Filters in a FilterBar use the Base UI Select.
 */
const NativeSelect = forwardRef(function NativeSelect({ className, wrapperClassName, size = "default", children, ...props }, ref) {
  return (
    <div data-slot="native-select-wrapper" className={cn("relative min-w-0", wrapperClassName)}>
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          "lsb-field w-full min-w-0 appearance-none rounded-md border border-border bg-card pl-2.5 pr-8 text-sm text-foreground shadow-xs",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
          size === "sm" ? "h-7 text-13" : "h-8",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <CaretUpDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-fg"
      />
    </div>
  );
});

export { NativeSelect };
