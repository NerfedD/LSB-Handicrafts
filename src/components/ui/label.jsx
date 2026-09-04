import { forwardRef } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/**
 * A field label.
 *
 * 16px, not 13px. A label is a sentence somebody reads to decide what to type,
 * so it sits above the floor like everything else — and the help text under
 * the field is 14.5px, which is the smallest anything gets outside a tracked
 * uppercase signpost.
 */
const Label = forwardRef(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "block text-[16px] font-bold text-ink",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
});

/**
 * The help text under a field.
 *
 * Rule 5: help text goes UNDER the field, not in a tooltip and not as
 * placeholder text that vanishes the moment somebody starts typing. Every
 * field that needs explaining gets one of these — "Write it the way staff say
 * it out loud","This decides which measurements we ask for next".
 */
function FieldHint({ className, ...props }) {
  return (
    <p
      className={cn("pt-2 text-[14.5px] leading-[1.45] text-muted", className)}
      {...props}
    />
  );
}

/**
 * A numbered band heading inside a form: "1. What is it?".
 *
 * Numbering the bands is what turns a wall of fields into a sequence, which is
 * the whole of rule 5 — one question at a time.
 */
function BandHeading({ className, children, ...props }) {
  return (
    <h3
      className={cn(
        "text-[18.5px] font-extrabold tracking-[-0.01em] text-ink",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export { Label, FieldHint, BandHeading };
