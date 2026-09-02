import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status chip.
 *
 * The tones below are the exact colours the six hand-rolled StatusBadge copies
 * were using, so nothing changes on screen. See shared/StatusPill.jsx for the
 * component that maps a status STRING onto one of these -- callers should use
 * that rather than picking a tone by hand, which is how two screens ended up
 * rendering a green chip for a Blocked account.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        success: "bg-[#287a5517] text-success",
        danger: "bg-[#b5474714] text-danger",
        warning: "bg-[#8a560014] text-warning",
        neutral: "bg-[#17263a0f] text-muted",
        brand: "bg-[#1746d12e] text-brand",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
