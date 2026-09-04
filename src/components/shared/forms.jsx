import { useId } from "react";

import { Check, Circle, CircleAlert, ImagePlus, Lock } from "../icons";
import { cn } from "@/lib/utils";
import { Input, LockedInput, Textarea } from "@/components/ui/input";
import { BandHeading, FieldHint, Label } from "@/components/ui/label";
import IconChip from "./Chip";

/**
 * Forms, per rule 5: one question at a time.
 *
 * "Forms run down a single column in numbered steps with help text under
 * fields, not a dense grid." Both halves of that matter, and the reason is the
 * same one: a two-column grid of twelve fields is read as a wall to be got
 * through, and the way people get through walls is by guessing. A numbered
 * single column is read as a sequence of questions, and a question with help
 * text under it gets answered rather than guessed.
 *
 * So there is deliberately no two-column layout primitive here. The one
 * exception is `Row`, for genuinely paired values — a diameter and its
 * category, a width and a length — where splitting them across two steps would
 * be pretending they are separate decisions.
 */

/**
 * A numbered band. `tinted` puts it on paper-2, which is how the handoff marks
 * the second band on the product form — a change of surface says "new
 * question" more quietly than a rule and more clearly than whitespace.
 */
export function FormBand({ step, title, tinted = false, children, className }) {
  return (
    <section
      className={cn(
        "border-b border-hair px-6.5 py-6 last:border-b-0",
        tinted && "bg-paper-2",
        className
      )}
    >
      {title && (
        <BandHeading className="pb-5">
          {step !== undefined && <span className="text-muted">{step}. </span>}
          {title}
        </BandHeading>
      )}
      <div className="flex flex-col gap-5.5">{children}</div>
    </section>
  );
}

/**
 * Label, control, help text, error.
 *
 * The control is wired to the label by a generated id rather than nested
 * inside it, because a nested <label> around a group of choice buttons makes
 * every button announce the whole group's label.
 *
 * HELP TEXT AND ERROR ARE MUTUALLY EXCLUSIVE by design: once a field is wrong,
 * the message that matters is what is wrong with it, and stacking a hint under
 * an error gives two instructions at the moment somebody is least able to read
 * two.
 */
export function Field({ label, hint, error, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  // A render-prop child takes the generated id, so the label can point at it.
  // A plain child is a GROUP -- choice buttons, radio cards -- which has no
  // single control to point at, and a `for` attribute naming an element that
  // does not exist is worse than none: a screen reader announces nothing.
  // Those groups carry their own aria-label instead.
  const isControl = typeof children === "function";

  return (
    <div className={className}>
      <Label htmlFor={isControl ? id : undefined} id={isControl ? undefined : `${id}-label`}>
        {label}
        {required && (
          <>
            {" "}
            <span className="font-normal text-muted">(needed)</span>
          </>
        )}
      </Label>
      <div className="pt-2">
        {isControl
          ? children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
          : children}
      </div>
      {hint && !error && <FieldHint id={`${id}-hint`}>{hint}</FieldHint>}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-start gap-2 pt-2 text-[14.5px] font-bold leading-[1.45] text-red-text"
        >
          <CircleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Two genuinely paired values side by side. See the note above. */
export function Row({ children, className }) {
  return (
    <div className={cn("grid gap-5.5 sm:grid-cols-2", className)}>{children}</div>
  );
}

/**
 * A choice made from a handful of big buttons rather than a dropdown.
 *
 * Used for the product kind (2g) and the role on the create dialog (2t). A
 * dropdown hides the options until opened and shows one at a time; four 50px
 * buttons show all of them at once, each with its shape icon, and are a single
 * tap rather than a tap-scroll-tap.
 *
 * Selected is a navy fill — deliberately not cobalt, which is reserved for
 * things that DO something. A selected option has not done anything yet.
 */
export function ChoiceButtons({ options, value, onChange, label, className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // The column count is a `className` rather than an inline grid-template,
      // so a caller can make it responsive. An inline style would win over the
      // media query and pin four 50px buttons across a 390px phone.
      className={cn("grid gap-2.5 grid-cols-2", className)}
    >
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
              "flex h-12.5 items-center justify-center gap-2.5 rounded-field border-[1.5px] px-3 text-[15.5px] font-bold transition duration-150",
              selected
                ? "border-navy bg-navy text-white"
                : "border-chip bg-surface text-ink hover:bg-wash"
            )}
          >
            {option.icon && <span className="shrink-0 text-[19px]">{option.icon}</span>}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Stacked radio cards that spell out what each option means.
 *
 * The change-role screen (2q) is the reason this exists. A list of five role
 * names is a quiz: nothing about the word "Manager" says whether it can delete
 * a staff account. Each card therefore carries a sentence saying what the
 * option unlocks, which turns choosing a role from a guess into a decision.
 */
export function RadioCards({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-3", className)}>
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
              "flex items-start gap-4 rounded-card border-2 bg-surface p-4.5 text-left transition duration-150",
              selected
                ? "border-cobalt bg-tint-cobalt/40"
                : "border-card hover:border-chip2 hover:bg-wash-2"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-cobalt" : "border-chip2"
              )}
            >
              {selected && <span className="size-2.5 rounded-full bg-cobalt" />}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[17.5px] font-extrabold text-ink">{option.label}</span>
              <span className="block pt-1.5 text-[15px] leading-[1.5] text-muted">
                {option.description}
              </span>
            </span>

            {option.icon && (
              <IconChip icon={option.icon} tone={option.tone ?? "cobalt"} size="md" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Two radio options with plain descriptions — the "How your dashboard looks"
 * card, and anything else that is a genuine either/or rather than a toggle.
 *
 * A switch would be smaller, and would be wrong: a switch implies a default
 * and an off state, where these are two equally valid ways to work.
 */
export function RadioRow({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-3", className)}>
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
              "flex items-start gap-3.5 rounded-field border-2 bg-surface p-4 text-left transition duration-150",
              selected ? "border-cobalt bg-tint-cobalt/40" : "border-card hover:bg-wash-2"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-cobalt" : "border-chip2"
              )}
            >
              {selected && <span className="size-2.5 rounded-full bg-cobalt" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[16.5px] font-extrabold text-ink">{option.label}</span>
              <span className="block pt-1 text-[15px] leading-[1.5] text-muted">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A dashed slot where a photo will go.
 *
 * Real product photography is one of the handoff's open questions, so these
 * are honest placeholders rather than stock images: a slot that says what
 * belongs in it and at what size is useful to whoever supplies the photo, and
 * a stock photo of somebody else's styrofoam would be worse than nothing.
 */
export function PhotoSlot({ ratio = "1 / 1", label, hint, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-tile2 border-2 border-dashed border-sketch bg-paper-2 p-6 text-center",
        className
      )}
      style={{ aspectRatio: ratio }}
    >
      <ImagePlus className="h-7 w-7 text-muted-2" aria-hidden="true" />
      <p className="text-[15px] font-bold text-muted">{label}</p>
      {hint && <p className="text-[14px] text-muted-2">{hint}</p>}
    </div>
  );
}

/**
 * A live requirement checklist, for the change-password screen.
 *
 * Validating as somebody types, rather than telling them after they submit
 * what they should have done, is the difference between a list of rules and a
 * list of progress. A met requirement goes green, bold and checked; an unmet
 * one stays a muted circle — so the shape of the list answers "am I done yet"
 * without reading it.
 */
export function RequirementList({ requirements, className }) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)} aria-live="polite">
      {requirements.map((requirement) => (
        <li key={requirement.label} className="flex items-center gap-2.5">
          {requirement.met ? (
            <Check className="h-5 w-5 shrink-0 text-green dark:text-dk-green" aria-hidden="true" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-muted-2" aria-hidden="true" />
          )}
          <span
            className={cn(
              "text-[15.5px]",
              requirement.met ? "font-bold text-ink" : "text-muted"
            )}
          >
            {requirement.label}
          </span>
          <span className="sr-only">{requirement.met ? "— done" : "— not yet"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The footer band of a form: the way out on the left, the way forward on the
 * right.
 *
 * Left and right rather than both on the right, because "Cancel" sitting
 * beside "Save" is how a form gets abandoned by somebody aiming for the button
 * next to it.
 */
export function FormFooter({ left, right, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-paper-2 px-6.5 py-5",
        className
      )}
    >
      <div className="flex flex-wrap gap-3">{left}</div>
      <div className="flex flex-wrap gap-3">{right}</div>
    </div>
  );
}

/**
 * A field that is fixed here and says why — the sign-in email on 2p.
 *
 * A greyed-out box with no explanation reads as a fault. The lock glyph plus
 * one line of help text ("Email cannot be changed here — it is how she signs
 * in") turns it into a rule somebody can accept.
 */
export function LockedField({ label, value, hint }) {
  return (
    <Field label={label} hint={hint}>
      {(props) => (
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-2"
            aria-hidden="true"
          />
          <LockedInput {...props} value={value ?? ""} />
        </div>
      )}
    </Field>
  );
}

export { Input, Textarea };
