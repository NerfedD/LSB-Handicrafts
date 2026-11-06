import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { Check, Minus } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Checkbox on Base UI: 16px, 4px radius, 1px --border on --card.
 * Checked (or indeterminate, for select-all) it fills --primary with a 12px
 * white tick that draws itself in (index.css).
 */
function Checkbox({ className, ...props }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-4 shrink-0 items-center justify-center rounded border border-border bg-card text-on-primary shadow-xs outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:bg-primary",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <Minus className="size-3" weight="bold" aria-hidden="true" />
            ) : (
              <Check className="size-3" weight="bold" aria-hidden="true" />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
