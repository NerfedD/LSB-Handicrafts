import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's one button.
 *
 * Replaces `shared/profileButtonStyles.js`, which exported raw class STRINGS
 * that callers concatenated to resize (`${secondaryButton} h-11 px-[22px]`).
 * That only worked when class order happened to favour the override; `cn()`
 * resolves the conflict properly.
 *
 * TWO PRIMARIES, ON PURPOSE. The app has two chrome systems with two different
 * primary colours -- AppShell (user management) is #1b3a6b, ManagementShell
 * (dashboards, profiles) is #1746d1. Rather than pick one and silently restyle
 * half the app, both ship as variants and each screen keeps the colour it has
 * today. Unifying them is a design decision that hasn't been made.
 *
 * Sizes match the heights already in use so no screen shifts: h-[38px] and
 * h-11 on ManagementShell, h-[46px]/h-[52px]/h-14 on AppShell.
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
        sm: "h-[38px] px-4",
        default: "h-11 px-5",
        lg: "h-[46px] px-[22px]",
        xl: "h-[52px] px-6",
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
