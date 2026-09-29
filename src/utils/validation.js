/**
 * Field rules shared by the forms, written to match the database's checks in
 * supabase/migrations/20260929120000_controlled_inputs_and_photos.sql. The
 * database is the rule; these say the same thing sooner, beside the field.
 *
 * Each returns a sentence when the value is wrong, and null when it is fine.
 */

export const MAX_COUNT = 2_000_000_000;

/** A whole number from a text field, or null when it is not one. */
export function wholeNumber(value) {
  const text = String(value ?? '').trim();
  return /^\d{1,10}$/.test(text) && Number(text) <= MAX_COUNT ? Number(text) : null;
}

/** A count: whole, and at least `min`. Whole numbers need no decimal point. */
export function countProblem(value, { min = 0, max = MAX_COUNT, label = 'This' } = {}) {
  const text = String(value ?? '').trim();
  if (text === '') return `${label} is needed.`;
  if (!/^\d+$/.test(text)) return `${label} must be a whole number, such as 12.`;
  const n = Number(text);
  if (n < min) return min === 1 ? `${label} must be at least 1.` : `${label} must be ${min} or more.`;
  if (n > max) return `${label} must be ${max.toLocaleString('en-PH')} or less.`;
  return null;
}

/**
 * An optional measurement: blank is "not recorded"; otherwise a number above
 * zero, within `max`, with at most three decimal places.
 */
export function measureProblem(value, { max, unit, label }) {
  const text = String(value ?? '').trim();
  if (text === '') return null;
  if (!/^(\d{1,9}(\.\d+)?|\.\d+)$/.test(text)) return `${label} must be a number above 0.`;
  if (/\.\d{4,}$/.test(text)) return `${label} can have at most 3 decimal places.`;
  const n = Number(text);
  if (n <= 0) return `${label} must be more than 0.`;
  if (n > max) return `${label} must be no more than ${max.toLocaleString('en-PH')} ${unit}.`;
  return null;
}

/** An amount of money: 0 or more, at most 100,000,000, two decimal places. */
export function moneyProblem(value, { label = 'The price', required = true } = {}) {
  const text = String(value ?? '').trim();
  if (text === '') return required ? `${label} is needed. Use 0 if there is no charge.` : null;
  if (!/^(\d{1,9}(\.\d+)?|\.\d+)$/.test(text)) return `${label} must be an amount of 0 or more.`;
  if (/\.\d{3,}$/.test(text)) return `${label} can have at most 2 decimal places.`;
  if (Number(text) > 100_000_000) return `${label} must be 100,000,000 or less.`;
  return null;
}

/**
 * A code staff type by hand (a raw material's): 2 to 40 letters, digits and
 * single hyphens, such as SS-100-4X8. Compared upper-case, as it is stored.
 */
export const CODE_RULE = 'Use 2 to 40 letters, numbers and single hyphens, such as SS-100-4X8.';
export function codeProblem(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (code === '') return null;
  if (code.length < 2 || code.length > 40 || !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(code)) return CODE_RULE;
  return null;
}

/** "  Styro   Balls " -> "Styro Balls": the spelling a label is stored in. */
export const tidyLabel = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** A counting unit: lower-case letters and single spaces, at most 24. */
export function unitProblem(value) {
  const unit = tidyLabel(value).toLowerCase();
  if (unit === '') return 'Choose the unit it is counted in.';
  if (unit.length > 24 || !/^[a-z]+( [a-z]+)*$/.test(unit)) {
    return 'Write the unit in letters only, such as sheet, roll or kg.';
  }
  return null;
}

/**
 * A name: needed and at most `max` characters. Any punctuation is fine -- 1/2",
 * A&B, (high-density) -- because a name is read, not matched. Line breaks and
 * runs of spaces are folded into one space when it is saved.
 */
export function nameProblem(value, { label = 'The name', max = 200 } = {}) {
  const name = tidyLabel(value);
  if (name === '') return `${label} is needed.`;
  if (name.length > max) return `${label} can be at most ${max} characters.`;
  return null;
}
