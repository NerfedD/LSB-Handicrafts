import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Text input.
 *
 * 54px tall, 11px radius, a 1.5px border and 16px text — the handoff's field
 * geometry. The old 44px/13px-text field was under both floors it sets: a
 * control has to be 44px to be tappable and the text inside it is a sentence
 * somebody reads, so it cannot be below 16px.
 *
 * `aria-invalid` drives the error tone rather than a prop, which is how
 * shared/ProfileForm already did it — so the field-level validation the forms
 * produce passes straight through, and assistive technology hears about the
 * error at the same time as the eye sees it.
 */
const fieldBase = [
  "w-full rounded-field border-[1.5px] border-field bg-surface text-[16px] text-ink",
  "placeholder:text-muted-2 transition duration-150",
  "hover:border-chip2",
  "focus:border-cobalt focus:outline-none focus:shadow-[0_0_0_4px_#1462c826]",
  "disabled:cursor-not-allowed disabled:border-chip disabled:bg-tint-neutral disabled:text-muted",
  "aria-[invalid=true]:border-red aria-[invalid=true]:focus:shadow-[0_0_0_4px_#a8332f26]",
  "dark:focus:border-dk-cobalt dark:focus:shadow-[0_0_0_4px_#3b8ae533]",
].join(" ");

const Input = forwardRef(function Input(
  { className, type = "text", hasLeadingIcon = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        fieldBase,
        "h-13.5 px-4",
        // A leading icon sits 16px in and is 20px wide, so the text has to
        // start past it. Passed as a flag rather than left to each caller to
        // remember, because a forgotten pl- is text overlapping an icon.
        hasLeadingIcon && "pl-12.5",
        className
      )}
      {...props}
    />
  );
});

const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, "min-h-24 resize-y px-4 py-3.5 leading-[1.5]", className)}
      {...props}
    />
  );
});

/**
 * A field that cannot be edited here, and says why.
 *
 * Used for the email on "manage one account" (2p): it is how the person signs
 * in, so changing it is not an edit to a detail. A disabled input alone reads
 * as a bug — the lock icon and the help text under it are what make it read as
 * a rule.
 */
const LockedInput = forwardRef(function LockedInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      readOnly
      className={cn(
        "h-13.5 w-full rounded-field border-[1.5px] border-chip bg-tint-neutral px-4 pl-12.5",
        "text-[16px] text-muted",
        className
      )}
      {...props}
    />
  );
});

export { Input, Textarea, LockedInput, fieldBase };
