import { Children, Fragment, cloneElement, isValidElement, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info, Warning } from '../icons';
import { cn } from '@/lib/utils';
import { Field } from '../shared/forms';
import FormError from '../shared/FormError';
import { reportFormError } from '../../utils/formErrors';

/**
 * The dialog form the workshop's dialogs share, drawn to the *Dialog boards:
 * the title and its line, the fields 14px apart (a 14/500 label over each
 * control, its help or its problem under it), and Cancel then the one
 * primary button on the right.
 *
 * `validate(values)` returns null when the form can be sent, a sentence for a
 * problem with the form as a whole, or `{ fieldName: sentence }` for problems
 * with particular fields. Field problems are shown beside their fields; the
 * note at the top only says how many there are.
 */

/** One question: label, control, and its help or problem. `options` makes it a select. */
export function WorkshopField({ label, hint, error, options, placeholder = 'Choose one', multiline, className, suffix, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={className}>
      {(a11y) =>
        options ? (
          <NativeSelect {...a11y} {...props}>
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </NativeSelect>
        ) : multiline ? (
          <Textarea {...a11y} {...props} rows={props.rows ?? 2} />
        ) : suffix ? (
          <div className="relative">
            <Input {...a11y} {...props} className="pr-14" />
            <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-13 text-muted-fg">{suffix}</span>
          </div>
        ) : (
          <Input {...a11y} {...props} />
        )
      }
    </Field>
  );
}

/** Hands each field its own error, found by its `name`, so a problem sits beside its field. */
function withErrors(node, errors) {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      return <Fragment key={child.key}>{withErrors(child.props.children, errors)}</Fragment>;
    }
    if (child.type === WorkshopField) {
      const error = child.props.error ?? (child.props.name ? errors[child.props.name] : undefined);
      return cloneElement(child, { error });
    }
    // Into layout wrappers too (a Row pairing two fields), so their fields get their errors.
    if (typeof child.type !== 'string' && child.props.children) {
      return cloneElement(child, undefined, withErrors(child.props.children, errors));
    }
    return child;
  });
}

/** The browser's own check on a field, in the words the rest of the app uses. */
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

export default function WorkshopForm({ title, description, submitLabel, submitVariant = 'default', cancelLabel = 'Cancel', size = 'md', initial, onSave, onClose, children, validate, footerNote }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const pending = useRef(false);
  const request = useRef(null);
  const change = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
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
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending.current) onClose(); }}>
      <DialogContent size={size} showClose={!saving}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <DialogBody>
            <FormError message={error} />
            <fieldset disabled={saving} className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
              {withErrors(children(values, change, setAll), fieldErrors)}
            </fieldset>
          </DialogBody>
          <DialogFooter className={footerNote ? 'items-center justify-between' : undefined}>
            {footerNote ? <span className="text-13 text-muted-fg">{footerNote(values)}</span> : null}
            <span className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={saving} onClick={onClose}>{cancelLabel}</Button>
              <Button type="submit" variant={submitVariant === 'danger' ? 'destructive' : 'default'} disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Here is what this will do": a quiet note under the fields. `warning` is the
 * warning tint with its mark; the plain one is neutral.
 */
export function ReviewBox({ children, warning = false, arrives = false }) {
  const Mark = warning ? Warning : Info;
  return (
    <div
      aria-live="polite"
      className={cn(
        'flex items-start gap-2.5 rounded-md border p-3 text-13',
        warning ? 'border-warning-bd bg-warning-bg' : 'border-border bg-muted',
        arrives && 'lsb-card-in'
      )}
    >
      <Mark className={cn('mt-px size-4 shrink-0', warning ? 'text-warning-fg' : 'text-muted-fg')} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-fg-2 [&>p]:m-0 [&>p]:mt-1 [&_strong]:font-medium [&_strong]:text-foreground">{children}</div>
    </div>
  );
}
