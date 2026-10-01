const SHOP_TIME_ZONE = 'Asia/Manila';
const shopCalendar = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Today as yyyy-mm-dd on the SHOP's calendar (Asia/Manila), whatever this
 * device's clock or time zone says.
 *
 * NOT toISOString().slice(0, 10), which is the UTC date: before 8am in Manila
 * that is still yesterday. NOT the device's own calendar either: a phone set to
 * another zone would accept or refuse a date the database decides differently.
 * The database checks the same rule against private.shop_today (Asia/Manila).
 */
export function localDateIso(date = new Date()) {
  const parts = Object.fromEntries(shopCalendar.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
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
