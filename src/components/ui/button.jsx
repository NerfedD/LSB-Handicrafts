import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The app's one button.
 *
 * ONE PRIMARY NOW. This file used to ship two — #1b3a6b for the
 * user-management screens and #2196f3 for the dashboards — with a note saying
 * that picking one was a design decision nobody had made. The UI overhaul made
 * it: cobalt is the action colour everywhere. `clay` and `green` are not
 * second primaries but jobs: clay marks production and supplier work, green is
 * reserved for the one confirm-forward action on a screen ("It arrived",
 * "Mark as done", "Let Ana sign in again").
 *
 * HEIGHTS COME FROM THE TAP-TARGET FLOOR, not from a t-shirt scale. The
 * handoff's rule is 44px minimum for anything tappable, 46–52px for buttons,
 * 52–56px for a primary call to action, and that is exactly what the four
 * sizes below are. There is no `xs`: a 36px button existed on the old screens
 * and is precisely what rule 1 rules out.
 *
 * NO ICON-ONLY BUTTONS. Rule 3 — "every icon has a word beside it" — is a
 * content rule this component cannot enforce, but it can decline to make the
 * wrong thing easy: the `icon` size is documented for dismiss affordances (a
 * dialog's close X, a search field's clear) and nothing else. A bare pencil or
 * trash icon in a row is a guess, and the row actions on every list screen
 * therefore read "View" and "Edit" beside their icons.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-btn font-bold transition duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    // The global :focus-visible ring in index.css covers this; the offset is
    // set here so a ring on a filled button sits clear of its own fill.
    "focus-visible:outline-offset-2",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The primary action. One per screen. */
        cobalt:
          "bg-cobalt text-white shadow-cobalt hover:bg-cobalt-deep dark:bg-dk-cobalt dark:text-dk-on-cobalt dark:hover:bg-[#5c9fea]",
        /** Chrome-coloured fill: sidebar-adjacent surfaces, selected states. */
        navy: "bg-navy text-white hover:bg-[#0b2547]",
        /**
         * Production and supplier work.
         *
         * The hover is spelled out for dark because `clay-deep` is a
         * FOREGROUND token — it flips to a light clay so clay text stays
         * readable on a dark surface, which is the wrong direction for a fill
         * sitting under white text.
         */
        clay: "bg-clay text-white shadow-card hover:bg-clay-deep dark:hover:bg-[#c9662e]",
        /** The single confirm-forward action on a screen. */
        green: "bg-green text-white shadow-card hover:bg-[#0b5537]",
        /** The standard secondary. 1.5px border, per the handoff. */
        outline:
          "border-[1.5px] border-chip bg-surface text-ink hover:bg-wash",
        /** Destructive, and always inside its own outlined block — never a red icon in a row. */
        danger:
          "border-[1.5px] border-red/[0.45] bg-surface text-red-text hover:bg-tint-red dark:border-dk-red/[0.45]",
        /** Solid destructive, for the confirm button inside a confirm dialog. */
        "danger-solid": "bg-red text-white hover:bg-[#8f2b28]",
        ghost:
          "text-ink hover:bg-wash",
        link: "font-bold text-cobalt dark:text-dk-cobalt underline-offset-[3px] hover:text-cobalt-deep hover:underline",
      },
      size: {
        /** 44px — the tap-target floor. Row actions, header utilities, chips-as-buttons. */
        sm: "h-11 gap-1.5 px-3.5 text-[14.5px]",
        /**
         * 54px — a button standing IN a filter row, beside the search box and
         * the dropdowns. It exists so that row is one height: the fields there
         * are 54px, and a 44px button next to them left an 8px step in the
         * middle of a single row on the staff screen.
         */
        field: "h-13.5 px-4 text-[15.5px]",
        /** 48px — the default. Header primary, in-card calls to action. */
        default: "h-12 px-5 text-[15.5px]",
        /** 52px — form footers, quick actions, the stacked buttons on a detail screen. */
        lg: "h-13 px-5 text-[16px]",
        /** 56px — the one big primary on an auth screen or a delivery detail. */
        xl: "h-14 px-6 text-[16.5px]",
        /** Dismiss affordances only. See the note above. */
        icon: "h-11 w-11 rounded-btn",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "cobalt", size: "default", block: false },
  }
);

const Button = forwardRef(function Button(
  { className, variant, size, block, asChild = false, type, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // A <button> inside a <form> submits by default, which is how "Cancel"
      // used to save the record it was cancelling. Only an explicit type="submit"
      // submits now.
      type={asChild ? type : type ?? "button"}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
});

export { Button, buttonVariants };
