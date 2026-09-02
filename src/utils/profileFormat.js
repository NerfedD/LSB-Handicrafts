/**
 * Display helpers for the profile screens.
 *
 * Dates USED to be stored as the long human string ("August 30, 2026"), in two
 * different formats across tables, which made chronological ordering in SQL
 * impossible — every "recent activity" panel was effectively sorting
 * alphabetically by month name. The columns are real `timestamptz` now, so
 * these functions format an ISO value for display and the database does the
 * sorting.
 *
 * `parse` still accepts the old long-form strings, so a value read from a
 * record written before the migration renders rather than showing a dash.
 */

const LONG = { year: "numeric", month: "long", day: "numeric" };
const SHORT = { year: "numeric", month: "short", day: "numeric" };

function parse(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "August 30, 2026" -> "Aug 30, 2026" for the Last Updated column. */
export function formatShortDate(value) {
  const date = parse(value);
  return date ? date.toLocaleDateString("en-US", SHORT) : value || "—";
}

/** Normalizes whatever is stored to "August 30, 2026" for the detail cards. */
export function formatLongDate(value) {
  const date = parse(value);
  return date ? date.toLocaleDateString("en-US", LONG) : value || "—";
}

/**
 * Now, as an ISO timestamp — what gets WRITTEN to created_at / updated_at.
 *
 * Display formatting is the job of formatShortDate / formatLongDate above.
 * Storing a formatted string is what broke sorting in the first place.
 */
export function nowIso() {
  return new Date().toISOString();
}

/** Time-of-day greeting, matching the dashboards' "Good morning, Maria." */
export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** 450 -> "₱450.00". Blank rather than "₱NaN" when the price is missing. */
export function formatPeso(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return `₱${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
