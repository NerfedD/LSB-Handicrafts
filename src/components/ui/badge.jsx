import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Badge, drawn to the boards: 20px tall, 6px across, a 4px radius,
 * 12px medium. Status badges carry a 6px dot and one word.
 *
 *   secondary   --muted on --border, --fg-2   (neutral states, counts)
 *   outline     --card on --border, --fg-2    (departments, categories)
 *   success / warning / destructive           soft tint, border and text
 */
const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded border px-1.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        secondary: "border-border bg-muted text-fg-2",
        outline: "border-border bg-card text-fg-2",
        success: "border-success-bd bg-success-bg text-success-fg",
        warning: "border-warning-bd bg-warning-bg text-warning-fg",
        destructive: "border-danger-bd bg-danger-bg text-danger-fg",
        primary: "border-primary bg-primary text-on-primary",
      },
    },
    defaultVariants: { variant: "secondary" },
  }
);

function Badge({ className, variant, dot = false, children, ...props }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", variant === "secondary" || !variant ? "bg-muted-fg" : "bg-current")}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
