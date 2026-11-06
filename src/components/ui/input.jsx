import { forwardRef, useId, useState } from "react";

import { cn } from "@/lib/utils";
import {
  cleanPhoneInput,
  PHONE_MAX_CHARS,
  PHONE_SHAPE_PATTERN,
  PHONE_TITLE,
} from "@/utils/phone";
import { refusedNumberText } from "@/utils/validation";

/**
 * Text field, as drawn on the dialog boards: 32px tall, 6px radius, a 1px
 * --border edge on --card, 14px text and shadow-xs. Focused, the edge turns
 * 2px --primary with a soft 3px halo (`.lsb-field` in index.css); an invalid
 * field turns its border --danger.
 *
 * The input rules are the app's, not the design's, and stay: a number field
 * refuses letters and signs before they land, and a phone field keeps only
 * what a phone number can contain.
 */
const fieldBase = [
  "w-full min-w-0 rounded-md border border-border bg-card text-sm text-foreground shadow-xs",
  "lsb-field placeholder:text-muted-2",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-fg disabled:opacity-70",
  "read-only:bg-muted read-only:text-fg-2",
  "aria-[invalid=true]:border-danger",
].join(" ");

const Input = forwardRef(function Input({ className, type = "text", hasLeadingIcon = false, ...props }, ref) {
  const errorId = useId();
  const [validationError, setValidationError] = useState("");
  const phone = type === "tel" || props.inputMode === "tel";
  const { onChange, onKeyDown, onPaste, ...rest } = props;

  const numberRule = type === "number"
    ? { whole: props.inputMode === "numeric" || String(props.step) === "1" }
    : null;

  const phoneProps = phone
    ? { type: "tel", inputMode: "numeric", pattern: PHONE_SHAPE_PATTERN, maxLength: PHONE_MAX_CHARS, title: PHONE_TITLE }
    : undefined;

  return (
    <>
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(fieldBase, "h-8 px-2.5", hasLeadingIcon && "pl-8", className)}
        {...rest}
        {...phoneProps}
        aria-describedby={[props["aria-describedby"], validationError ? errorId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={validationError ? true : props["aria-invalid"]}
        onInvalid={(event) => setValidationError(event.currentTarget.validationMessage)}
        onKeyDown={(event) => {
          if (numberRule && event.key.length === 1 && !event.ctrlKey && !event.metaKey
            && refusedNumberText(event.key, numberRule)) event.preventDefault();
          onKeyDown?.(event);
        }}
        onPaste={(event) => {
          if (numberRule && refusedNumberText(event.clipboardData.getData("text").trim(), numberRule)) {
            event.preventDefault();
          }
          onPaste?.(event);
        }}
        onChange={(event) => {
          if (phone) {
            const cleaned = cleanPhoneInput(event.target.value);
            if (cleaned !== event.target.value) event.target.value = cleaned;
          }
          setValidationError("");
          event.target.removeAttribute("aria-invalid");
          onChange?.(event);
        }}
      />
      {validationError && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{validationError}</p>
      )}
    </>
  );
});

const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-slot="textarea"
      className={cn(fieldBase, "min-h-16 resize-y px-2.5 py-1.5", className)}
      {...props}
    />
  );
});

/** A value shown in field shape that cannot be edited here. */
const LockedInput = forwardRef(function LockedInput({ className, ...props }, ref) {
  return <input ref={ref} readOnly className={cn(fieldBase, "h-8 px-2.5", className)} {...props} />;
});

export { Input, Textarea, LockedInput, fieldBase };
