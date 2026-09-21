import { forwardRef, useId, useState } from "react";

import { cn } from "@/lib/utils";
import {
  cleanPhoneInput,
  PHONE_MAX_CHARS,
  PHONE_SHAPE_PATTERN,
  PHONE_TITLE,
} from "@/utils/phone";

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
  const errorId = useId();
  const [validationError, setValidationError] = useState('');
  // A caller says WHAT the field is -- type="tel" -- and this decides how it
  // behaves, down to which keypad. A caller that sets inputMode itself is
  // therefore not declaring a phone field, which is why that spelling is still
  // read but nothing relies on it.
  const phone = type === 'tel' || props.inputMode === 'tel';
  const { onChange, ...rest } = props;

  /**
   * THE PHONE FIELD DEFERS TO utils/phone. It does not carry its own rule.
   *
   * It used to: `pattern="[0-9]{7,15}"`, a `minLength`/`maxLength` counting
   * CHARACTERS rather than digits, and a numeric keypad with no + on it. Every
   * other layer — utils/phone, and the `contact_number_ok` constraint in
   * schema.sql — allows punctuation and counts digits, so this field was at
   * once the strictest rule in the stack and the only wrong one. A number
   * already sitting in the customers table, `0917 555 0204`, could not be saved
   * back from the screen that displayed it: guardForm found the element
   * invalid and refused the submit with the browser's own "Please match the
   * requested format".
   *
   * What is left here is shape, and the database's own character cap. The digit
   * count belongs to phoneProblem, which can say "that has 4 digits" instead.
   */
  const phoneProps = phone
    ? {
        type: 'tel',
        inputMode: 'numeric',
        pattern: PHONE_SHAPE_PATTERN,
        maxLength: PHONE_MAX_CHARS,
        title: PHONE_TITLE,
      }
    : undefined;
  return (
    <>
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
      {...rest}
      {...phoneProps}
      aria-describedby={[props['aria-describedby'], validationError ? errorId : null].filter(Boolean).join(' ') || undefined}
      aria-invalid={validationError ? true : props['aria-invalid']}
      onInvalid={(event) => setValidationError(event.currentTarget.validationMessage)}
      onChange={(event) => {
        // A letter never lands in the box at all, rather than landing and being
        // complained about later — see cleanPhoneInput for the argument. Doing
        // it HERE rather than in each caller is why the one screen that forgot
        // (staff -> manage an account) is covered without knowing about it.
        //
        // The previous guard dropped the whole keystroke instead of stripping
        // it, and judged it with the same digits-only rule as the pattern — so
        // a space could not be typed into a field whose own placeholder reads
        // "09XX XXX XXXX", and the message explaining why was itself wrong.
        if (phone) {
          const cleaned = cleanPhoneInput(event.target.value);
          if (cleaned !== event.target.value) event.target.value = cleaned;
        }
        setValidationError('');
        event.target.removeAttribute('aria-invalid');
        onChange?.(event);
      }}
    />
    {validationError && <p id={errorId} role="alert" className="pt-2 text-[16px] font-bold text-red-text">{validationError}</p>}
    </>
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
