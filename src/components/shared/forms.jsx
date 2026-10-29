import { useId } from "react";

import { Check, Circle, ImageSquare, Lock, Warning, WarningCircle } from "../icons";
import { cn } from "@/lib/utils";
import { Input, LockedInput, Textarea } from "@/components/ui/input";
import { BandHeading, FieldHint, Label } from "@/components/ui/label";

/**
 * The form parts every dialog board is drawn from: a 14/500 label 6px above
 * its control, a 12px muted hint or a 12px danger message under it, fields
 * 14px apart, pairs in a two-column grid 12px apart.
 *
 * The validation itself is the app's: a field shows whatever message the
 * screen hands it.
 */

/** A group of fields with an optional 14px heading, ruled off from the next group. */
export function FormBand({ step, title, tinted = false, children, className }) {
  return (
    <section className={cn("border-b border-border-subtle px-5 py-4 last:border-b-0", tinted && "bg-surface-2", className)}>
      {title ? (
        <BandHeading className="mb-3">
          {step !== undefined ? <span className="text-muted-fg">{step}. </span> : null}
          {title}
        </BandHeading>
      ) : null}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/**
 * A label, its control, and the line under it. Pass the control as a
 * function to receive the id and aria wiring: `{(props) => <Input {...props} />}`.
 */
export function Field({ label, hint, error, warning, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : warning ? `${id}-warning` : hint ? `${id}-hint` : undefined;
  const isControl = typeof children === "function";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={isControl ? id : undefined} id={isControl ? undefined : `${id}-label`}>
        <span>
          {label}
          {required ? <span className="font-normal text-muted-fg"> (needed)</span> : null}
        </span>
      </Label>
      <div>
        {isControl
          ? children({ id, required, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
          : children}
      </div>
      {hint && !error && !warning ? <FieldHint id={`${id}-hint`} className="mt-0">{hint}</FieldHint> : null}
      {warning && !error ? (
        <p id={`${id}-warning`} aria-live="polite" className="m-0 flex items-start gap-1.5 text-xs font-medium text-warning-fg">
          <Warning className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="m-0 flex items-start gap-1.5 text-xs font-medium text-danger-fg">
          <WarningCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Two fields side by side, 12px apart; stacked on a phone. */
export function Row({ children, className }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}

/**
 * A small set of exclusive choices drawn as the boards' segmented control: a
 * --muted track with the chosen option as a --card chip. Neutral, never blue.
 */
export function ChoiceButtons({ options, value, onChange, label, className }) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("seg w-full rounded-md bg-muted p-0.5", className)}
      style={{ "--seg-count": options.length, "--seg-index": index }}
    >
      <span className="seg-ind" aria-hidden="true" />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded px-2.5 text-13 font-medium",
              selected ? "text-foreground" : "text-muted-fg hover:text-foreground"
            )}
          >
            {option.icon ? <span className="flex shrink-0 [&_svg]:size-4">{option.icon}</span> : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const radioMark = (selected) => (
  <span
    aria-hidden="true"
    className={cn(
      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-card shadow-xs",
      selected ? "border-primary-text" : "border-border"
    )}
  >
    {selected ? <span data-radio-dot className="size-2 rounded-full bg-primary" /> : null}
  </span>
);

/**
 * Choices with a line of explanation each, as bordered cards. The chosen one
 * gets a --primary-text ring and dot, as the radio cards on the dialog boards.
 */
export function RadioCards({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-start gap-3 rounded-md border bg-card p-3 text-left",
              selected ? "border-primary-text shadow-[0_0_0_1px_var(--primary-text)]" : "border-border hover:bg-surface-2"
            )}
          >
            {radioMark(selected)}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              {option.description ? <span className="block text-13 text-muted-fg">{option.description}</span> : null}
            </span>
            {option.icon ? <span className="flex shrink-0 text-muted-fg [&_svg]:size-5">{option.icon}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Radios in a column, each a 16px ring and its label (and a muted line). */
export function RadioRow({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="flex min-h-7 items-start gap-2 border-0 bg-transparent py-1 text-left text-sm text-foreground"
          >
            {radioMark(selected)}
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.description ? <span className="block text-13 text-muted-fg">{option.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** An empty photo slot: a dashed --border box with an image mark. */
export function PhotoSlot({ ratio = "1 / 1", label, hint, className }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-2 p-4 text-center", className)}
      style={{ aspectRatio: ratio }}
    >
      <ImageSquare className="size-5 text-muted-fg" aria-hidden="true" />
      <p className="m-0 text-13 font-medium text-fg-2">{label}</p>
      {hint ? <p className="m-0 text-xs text-muted-fg">{hint}</p> : null}
    </div>
  );
}

/** Password rules, each ticked off as it is met. */
export function RequirementList({ requirements, className }) {
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-1 p-0", className)} aria-live="polite">
      {requirements.map((requirement) => (
        <li key={requirement.label} className="flex items-center gap-2 text-xs">
          {requirement.met ? (
            <Check className="size-3.5 shrink-0 text-success-fg" weight="bold" aria-hidden="true" />
          ) : (
            <Circle className="size-3.5 shrink-0 text-muted-2" aria-hidden="true" />
          )}
          <span className={requirement.met ? "text-foreground" : "text-muted-fg"}>{requirement.label}</span>
          <span className="sr-only">{requirement.met ? "— done" : "— not yet"}</span>
        </li>
      ))}
    </ul>
  );
}

/** The foot of a form: the way out on the left, the way forward on the right. */
export function FormFooter({ left, right, className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3", className)}>
      <div className="flex flex-wrap gap-2">{left}</div>
      <div className="flex flex-wrap gap-2">{right}</div>
    </div>
  );
}

/** A value shown in field shape that cannot be changed here. */
export function LockedField({ label, value, hint }) {
  return (
    <Field label={label} hint={hint}>
      {(props) => (
        <div className="relative">
          <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-fg" aria-hidden="true" />
          <LockedInput {...props} value={value ?? ""} className="pl-8" />
        </div>
      )}
    </Field>
  );
}

export { Input, Textarea };
