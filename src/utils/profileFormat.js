/**
 * Display helpers for the profile screens.
 *
 * Dates are stored as the long human string ("August 30, 2026") rather than an
 * ISO timestamp, matching how `deliveries` / `orders` / `activity_log` already
 * store theirs. These functions only reformat for display — they never parse a
 * stored value back into something the database sorts on.
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

/** Today, in the same long format new records are stamped with. */
export function todayLongDate() {
  return new Date().toLocaleDateString("en-US", LONG);
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
