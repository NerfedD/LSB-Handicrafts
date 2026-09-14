import { toast } from 'sonner';

export const PHONE_PATTERN = /^[0-9]{7,15}$/;
export const PHONE_MESSAGE = 'Use 7 to 15 digits, including the country code for international numbers.';

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
