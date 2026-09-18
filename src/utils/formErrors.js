import { toast } from 'sonner';

/*
 * There is deliberately no PHONE_PATTERN here any more.
 *
 * This file exported one — /^[0-9]{7,15}$/ — alongside a PHONE_MESSAGE saying
 * "Use 7 to 15 digits". Nothing imported either of them; the live copy of that
 * same wrong rule was hardcoded in ui/input.jsx, which is what made a stored
 * number with spaces in it unsaveable. Two dead exports spelling out the rule a
 * fifth time are how a fix gets undone six months later, so they are gone. The
 * rule is in utils/phone.js and in the contact_number_ok constraint, and those
 * two agree with each other.
 */

export function reportFormError(form, message) {
  toast.error(message);
  requestAnimationFrame(() => {
    const target = form?.querySelector('[aria-invalid="true"]') ?? form?.querySelector('[data-form-error], :invalid');
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  });
}

export function guardForm(form) {
  const invalid = [...form.elements].find((field) => field.willValidate && !field.validity.valid);
  if (!invalid) return true;
  invalid.setAttribute('aria-invalid', 'true');
  reportFormError(form, invalid.validationMessage);
  invalid.reportValidity();
  return false;
}
