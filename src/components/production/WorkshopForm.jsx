import { Children, Fragment, cloneElement, isValidElement, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, Info, TriangleAlert } from '../icons';
import { cn } from '@/lib/utils';
import { Field, FormBand } from '../shared/forms';
import IconChip from '../shared/Chip';
import { tone as toneOf } from '../shared/tones';
import FormError from '../shared/FormError';
import { reportFormError } from '../../utils/formErrors';

/**
 * THE 16px FLOOR IS THE REASON THIS DIALOG HAS ITS OWN WRAPPER.
 *
 * The shared Field/Callout primitives set help text at 14.5–15.5px, which is
 * the app's ordinary register. Every screen in the workshop is read standing
 * at a bench by someone counting sheets, so these forms hold the house floor
 * of 16px for anything read as a sentence — and tests/production.spec.js
 * asserts it on a 390px viewport. Stating it once here beats three different
 * arbitrary overrides drifting apart later.
 */
const READABLE = '[&_p]:text-[16px] [&_label]:text-[16px] [&_[data-form-error]]:text-[16px]';

/**
 * One question, in its own numbered band.
 *
 * The visible question is the band heading; the <label> is still rendered and
 * still wired to the control, just visually hidden, so the accessible name and
 * the question a sighted user reads are the same string rather than two
 * strings that can drift.
 *
 * NO `number` PROP. It used to be hardcoded per field, which is how editing a
 * material produced bands numbered "2." and "3." with no "1.", and how a
 * completion form with no damage ran "1, 2, 4". WorkshopForm numbers whatever
 * actually rendered — see `numbered` below.
 */
export function WorkshopField({ number, label, hint, error, options, placeholder = 'Choose one', multiline, ...props }) {
  const title = (
    <>
      {label}
      {props.required && <span className="font-normal text-muted"> (needed)</span>}
    </>
  );

  return (
    <FormBand step={number} title={title} className="px-0 py-4">
      <Field label={label} hint={hint} error={error} required={props.required} className="[&_label]:sr-only">
        {(a11y) =>
          options ? (
            <div className="relative">
              <select
                {...a11y}
                {...props}
                className={cn(fieldBase, 'h-13.5 appearance-none py-0 pl-4 pr-12')}
              >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              />
            </div>
          ) : multiline ? (
            <Textarea {...a11y} {...props} />
          ) : (
            <Input {...a11y} {...props} />
          )
        }
      </Field>
    </FormBand>
  );
}

/**
 * Walks the rendered tree and numbers the WorkshopFields that survived their
 * conditions, in order. Derived from children on every render rather than
 * counted into a ref, so it cannot drift when React re-renders the body.
 *
 * It also hands each field its own error, found by the field's `name` -- the
 * same key the form's values use -- so a problem is stated beside the field it
 * is about rather than only in a box at the top.
 */
function numbered(node, counter, errors) {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      return <Fragment key={child.key}>{numbered(child.props.children, counter, errors)}</Fragment>;
    }
    if (child.type === WorkshopField) {
      counter.n += 1;
      const error = child.props.error ?? (child.props.name ? errors[child.props.name] : undefined);
      return cloneElement(child, { number: counter.n, error });
    }
    return child;
  });
}

/**
 * The browser's own check on a field (needed, too small, not whole), in the
 * words the rest of the app uses. Its built-in bubbles were the only error some
 * of these fields could show, in the browser's language rather than ours.
 */
function nativeProblem(el) {
  const v = el.validity;
  if (v.valueMissing) return el.tagName === 'SELECT' ? 'Choose one from the list.' : 'This is needed.';
  if (v.badInput) return 'Enter a number, using digits only.';
  if (v.rangeUnderflow) return `Enter ${el.min} or more.`;
  if (v.rangeOverflow) return `Enter ${Number(el.max).toLocaleString('en-PH')} or less.`;
  if (v.stepMismatch) {
    const places = String(el.step).split('.')[1]?.length ?? 0;
    return places === 0 ? 'Enter a whole number, without decimals.' : `Use at most ${places} decimal ${places === 1 ? 'place' : 'places'}.`;
  }
  if (v.tooLong) return `Keep this to ${el.maxLength} characters.`;
  if (v.patternMismatch) return el.title || 'This is not in the expected format.';
  return el.validationMessage;
}

/**
 * `validate(values)` returns null when the form can be sent, a sentence for a
 * problem with the form as a whole, or `{ fieldName: sentence }` for problems
 * with particular fields. Field problems are shown beside their fields; the
 * box at the top only says how many there are.
 */
export default function WorkshopForm({ title, description, submitLabel, initial, onSave, onClose, children, validate }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const pending = useRef(false);
  const request = useRef(null);
  const change = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Cleared as soon as they start fixing it, rather than on the next submit.
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const setAll = (update) => {
    setValues(update);
    setFieldErrors({});
  };
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const problem = validate?.(values);
    const found = problem && typeof problem === 'object'
      ? Object.fromEntries(Object.entries(problem).filter(([, message]) => message))
      : {};
    for (const el of form.elements) {
      if (el.name && el.willValidate && !el.validity.valid && !found[el.name]) found[el.name] = nativeProblem(el);
    }
    const count = Object.keys(found).length;
    if (typeof problem === 'string' || count > 0) {
      const message = typeof problem === 'string' ? problem
        : count === 1 ? Object.values(found)[0] : `Check the ${count} fields marked below.`;
      setFieldErrors(found);
      setError(message);
      reportFormError(form, message);
      return;
    }
    setFieldErrors({});
    const payload = JSON.stringify(values);
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setSaving(true); setError(null);
    try {
      const result = await onSave(values, request.current.id);
      if (!result?.ok) throw new Error(result?.message || 'This change was not saved. Please retry.');
      onClose();
    } catch (cause) { setError(cause.message); reportFormError(form, cause.message); }
    finally { pending.current = false; setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !pending.current) onClose(); }}>
    <DialogContent className={cn('max-w-[620px] text-[16px]', READABLE)} showClose={!saving}>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="text-[16px]">{description}</DialogDescription></DialogHeader>
        <DialogBody>
          <FormError message={error} />
          <fieldset disabled={saving} className="min-w-0">
            {numbered(children(values, change, setAll), { n: 0 }, fieldErrors)}
          </fieldset>
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="outline" size="lg" disabled={saving} onClick={onClose}>Go back</Button>
          <Button type="submit" size="lg" variant="clay" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/**
 * The "here is what this will do" block that sits under a workshop form.
 *
 * Built from the same tint/border/foreground trio as every pill, chip and
 * callout in the app (shared/tones.js) rather than from two hand-picked
 * background classes — which is what made it flat, borderless and identical
 * whether it was confirming a total or warning that stock is about to move.
 * `warning` is amber and carries an alert glyph; the plain one is neutral and
 * carries an info glyph, so the two are told apart before either is read.
 *
 * `arrives` marks the one that is mounted by a count rather than present from
 * the start — see the note beside it below.
 */
export function ReviewBox({ children, warning = false, arrives = false }) {
  const t = toneOf(warning ? 'amber' : 'neutral');
  return (
    <div
      aria-live="polite"
      className={cn(
        'my-4 flex items-start gap-3.5 rounded-field border-[1.5px] p-4.5',
        t.tint,
        t.border,
        // `arrives` is for the box that only exists once the counts are in. It
        // is the form answering a number somebody just typed, and it appears
        // below the field they are still looking at, so it rises into place
        // rather than being there suddenly. The boxes that are always on screen
        // do not take this: a block that re-animates every keystroke is a
        // flicker, not feedback.
        arrives && 'lsb-rise'
      )}
    >
      <IconChip
        icon={warning ? <TriangleAlert className="h-4.5 w-4.5" /> : <Info className="h-4.5 w-4.5" />}
        tone={warning ? 'amber' : 'neutral'}
        size="sm"
        className="bg-white/60 dark:bg-white/[0.08]"
      />
      <div className="min-w-0 flex-1 text-[16px] leading-[1.5] text-ink-2 [&>p]:pt-1.5">
        {children}
      </div>
    </div>
  );
}
