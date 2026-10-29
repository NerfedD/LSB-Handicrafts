import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui RadioGroup on Base UI. A 16px ring on --card with shadow-xs; the
 * selected item's ring turns --primary-text and an 8px --primary dot springs
 * in (index.css). Its label sits 8px to the right at 14px.
 */
function RadioGroup({ className, ...props }) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />;
}

function RadioGroupItem({ className, children, ...props }) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-xs outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "data-[checked]:border-primary-text data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator data-radio-dot className="size-2 rounded-full bg-primary" />
      {children}
    </RadioPrimitive.Root>
  );
}

/** A radio with its label beside it, as most of the boards draw them. */
function RadioOption({ value, label, description, className, disabled }) {
  return (
    <label
      className={cn(
        "flex min-h-7 cursor-pointer items-start gap-2 py-1 text-sm text-foreground",
        "has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60",
        className
      )}
    >
      <RadioGroupItem value={value} disabled={disabled} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description ? <span className="block text-13 text-muted-fg">{description}</span> : null}
      </span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem, RadioOption };
