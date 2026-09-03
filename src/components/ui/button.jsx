import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's one button.
 *
 * Replaces `shared/profileButtonStyles.js`, which exported raw class STRINGS
 * that callers concatenated to resize (`${secondaryButton} h-11 px-6`).
 * That only worked when class order happened to favour the override; `cn()`
 * resolves the conflict properly.
 *
 * TWO PRIMARIES, ON PURPOSE. The app has two chrome systems with two different
 * primary colours -- AppShell (user management) is #1b3a6b, ManagementShell
 * (dashboards, profiles) is #1746d1. Rather than pick one and silently restyle
 * half the app, both ship as variants and each screen keeps the colour it has
 * today. Unifying them is a design decision that hasn't been made.
 *
 * THREE HEIGHTS, ON THE 4px GRID. The app had twelve distinct interactive
 * heights (38, 42, 45, 46, 49.5, 52, 54, 60, 63...), most of them arbitrary px
 * that ignored the spacing scale. They collapse to:
 *
 *   sm      36px  filters, row actions, search
 *   default 44px  the standard control height, matching Input and Select
 *   lg      52px  the full-width submit buttons on the auth and account forms
 *
 * `xl` is kept as an alias of `lg` so existing call sites don't break; prefer
 * `lg` in new code.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ManagementShell primary
        brand: "bg-brand text-white hover:bg-[#1238ab]",
        // AppShell primary
        navy: "bg-navy text-white hover:bg-ink",
        // The shared outline treatment, identical in both shells
        outline:
          "border border-[#17263a29] bg-white text-ink hover:bg-[#17263a08]",
        ghost: "text-ink hover:bg-[#17263a08]",
        destructive: "bg-danger text-white hover:bg-[#9c3c3c]",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4",
        default: "h-11 px-5",
        lg: "h-13 px-6",
        xl: "h-13 px-6",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "default",
    },
  }
);

const Button = forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { Button, buttonVariants };
