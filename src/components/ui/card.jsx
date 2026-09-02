import { forwardRef } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's card shell.
 *
 * There were four of these, spread across eight files, differing in border
 * alpha, corner radius and shadow blur:
 *
 *   rounded-xl     #17263a14  0_1px_4px                 x4
 *   rounded-2xl    #17263a12  0_4px_32px + 0_1px_6px    x3
 *   rounded-[14px] #17263a1a  0_1px_4px                 x1
 *   rounded-[14px] #17263a14  0_1px_6px                 x1
 *
 * The first two are a real distinction and both are kept: the ManagementShell
 * screens (dashboards, profiles) sit on a flat, quiet card, while the AppShell
 * screens (user management) sit on a more lifted one. Same reasoning as the two
 * Button primaries -- picking one would silently restyle half the app.
 *
 * The last two were not a distinction, just drift. They snap to `flat`, which
 * is what they were already all but identical to.
 *
 * `overflow-hidden` is the default because most of these cards have a header
 * or footer strip that needs clipping to the radius. Pass `overflow-visible`
 * to opt out -- cn() resolves the conflict.
 */
const cardVariants = cva("bg-white", {
  variants: {
    variant: {
      flat: "rounded-xl border border-[#17263a14] shadow-[0_1px_4px_rgba(23,38,58,0.05)]",
      raised:
        "rounded-2xl border border-[#17263a12] shadow-[0_4px_32px_rgba(17,30,50,0.08),0_1px_6px_rgba(17,30,50,0.05)]",
    },
    clip: {
      true: "overflow-hidden",
      false: "",
    },
  },
  defaultVariants: { variant: "flat", clip: true },
});

const Card = forwardRef(function Card(
  { className, variant, clip, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, clip }), className)}
      {...props}
    />
  );
});

export { Card, cardVariants };
