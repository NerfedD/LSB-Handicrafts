/**
 * Today as yyyy-mm-dd on this device's own calendar.
 *
 * NOT toISOString().slice(0, 10), which is the UTC date: before 8am in Manila
 * that is still yesterday, and a "no dates in the past" rule built on it would
 * accept yesterday for eight hours a day. The database checks the same rule
 * against the shop's date (private.shop_today, Asia/Manila).
 */
export function localDateIso(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The message for a promised date, or null when it is acceptable.
 *
 * A date already on a record (`previous`) is left alone even if it has passed,
 * so an old order can still have its notes or driver corrected; only a date
 * somebody is typing now has to be today or later.
 */
export function promisedDateProblem(value, previous = null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter the date as a calendar date.';
  if (value === previous) return null;
  return value < localDateIso() ? 'That date has already passed. Choose today or a later date.' : null;
}
