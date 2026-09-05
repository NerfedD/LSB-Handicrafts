import { forwardRef } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's card shell.
 *
 * There were four of these across eight files, differing in border alpha,
 * radius and shadow blur, plus a fifth set on the legacy workspace screens
 * using zinc borders and their own dark mode. They collapse to one: 14px
 * radius, a single hairline at #111d2b1f, and the flat 1px card shadow.
 *
 * `lift` is the only genuine variant, and it earns its place on exactly one
 * element per screen — the "needs your attention" card on the dashboards. The
 * extra shadow is what makes that card read as the thing to look at first;
 * spending it anywhere else spends it everywhere.
 *
 * `overflow-hidden` is the default because most of these cards carry a header
 * band or a footer strip that has to be clipped to the radius. Pass
 * `clip={false}` to opt out — cn() is tailwind-merge, so the conflict resolves.
 */
const cardVariants = cva(
  "border border-card bg-surface",
  {
    variants: {
      variant: {
        default: "rounded-card shadow-card",
        /** Deliberately lifted off the canvas. One per screen. */
        lift: "rounded-card shadow-lift",
        /** The large destination tiles on the large-text dashboard. */
        feature: "rounded-feature shadow-card",
      },
      clip: { true: "overflow-hidden", false: "" },
    },
    defaultVariants: { variant: "default", clip: true },
  }
);

const Card = forwardRef(function Card({ className, variant, clip, ...props }, ref) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant, clip }), className)} {...props} />
  );
});

/**
 * A card's header row: 18px/22px padding, a hairline under it, and room for a
 * trailing "Updated 4 minutes ago" or "See all" on the right.
 */
const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 border-b border-hair2 px-5.5 py-4.5",
        className
      )}
      {...props}
    />
  );
});

/** 18px/800 — the card heading size from the handoff. */
const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn("text-[18px] font-extrabold text-ink", className)}
      {...props}
    />
  );
});

/**
 * The footer band: paper-2, no shadow, and the place a "Showing 1–6 of 148"
 * line or a pair of pager buttons goes.
 */
const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 bg-paper-2 px-5.5 py-4",
        className
      )}
      {...props}
    />
  );
});

export { Card, CardHeader, CardTitle, CardFooter, cardVariants };
