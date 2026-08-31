/**
 * Recent-activity feeds for the role dashboards (Figma #23 / #24).
 *
 * There is no activity table behind the profile screens — but every customer,
 * product and supplier row already carries `createdAt` and `updatedAt`, which
 * is enough to say what happened and when. A row whose updatedAt differs from
 * its createdAt was edited; otherwise it was newly added. That keeps these
 * panels honest: they describe real records rather than a fabricated log.
 *
 * Dates are stored as display strings ("August 30, 2026") with no time
 * component, so entries are dated to the day. The mockup's "Today, 9:15 AM"
 * becomes "Today" — showing a clock time the data doesn't have would be
 * inventing precision.
 */

import { formatShortDate } from "./profileFormat";

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today" / "Yesterday" / "Aug 27, 2026". */
export function relativeDay(value) {
  const date = parseDate(value);
  if (!date) return value || "—";

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatShortDate(value);
}

/** True when the record last changed today — drives the "events today" counter. */
export function changedToday(record) {
  const date = parseDate(record?.updatedAt || record?.createdAt);
  return date ? startOfDay(date) === startOfDay(new Date()) : false;
}

/**
 * Turns records into dated activity entries, newest first.
 *
 * `noun` names the thing in the sentence ("customer" -> "New customer added").
 * `subtitleOf` optionally supplies a second line, e.g. a product's item code.
 */
export function activityFrom(records = [], noun = "record", subtitleOf) {
  return records
    .map((record) => {
      const edited = Boolean(
        record.updatedAt && record.createdAt && record.updatedAt !== record.createdAt
      );
      const when = edited ? record.updatedAt : record.createdAt;
      return {
        id: record.id,
        name: record.name,
        subtitle: subtitleOf ? subtitleOf(record) : null,
        action: edited ? `${noun} profile updated` : `New ${noun} added`,
        kind: edited ? "Updated" : "Added",
        when,
        sortKey: parseDate(when)?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey);
}

/** Pill colours for the Added / Updated chips on those panels. */
export const ACTIVITY_PILL_STYLES = {
  Added: "bg-[#287a5514] text-[#287a55]",
  Updated: "bg-[#1746d114] text-[#1746d1]",
};
