/** Activity feed presentation. Business events are written atomically by SQL triggers. */

import { supabase } from "../lib/supabaseClient";

/**
 * The kinds of thing that happen, and the filter chips on the activity screen.
 *
 * `chip` groups several kinds under one filter: "Stock changes" covers both a
 * count being corrected and goods being recorded as made, because somebody
 * looking for "what happened to the stock" does not care which of those it was.
 */
export const ACTIVITY_KIND = {
  SIGN_IN: "sign-in",
  STOCK: "stock",
  PRICE: "price",
  ACCOUNT: "account",
  ORDER: "order",
  DELIVERY: "delivery",
  PRODUCT: "product",
  CUSTOMER: "customer",
  SUPPLIER: "supplier",
};

/** icon name + tone per kind. Names resolve in shared/activityIcons.jsx. */
export const KIND_STYLE = {
  [ACTIVITY_KIND.SIGN_IN]:  { icon: "LogIn", tone: "cobalt" },
  [ACTIVITY_KIND.STOCK]:    { icon: "Boxes", tone: "clay" },
  [ACTIVITY_KIND.PRICE]:    { icon: "Tag", tone: "green" },
  [ACTIVITY_KIND.ACCOUNT]:  { icon: "UserCog", tone: "purple" },
  [ACTIVITY_KIND.ORDER]:    { icon: "ClipboardList", tone: "cobalt" },
  [ACTIVITY_KIND.DELIVERY]: { icon: "Truck", tone: "amber" },
  [ACTIVITY_KIND.PRODUCT]:  { icon: "Package", tone: "neutral" },
  [ACTIVITY_KIND.CUSTOMER]: { icon: "UserRound", tone: "purple" },
  [ACTIVITY_KIND.SUPPLIER]: { icon: "Handshake", tone: "clay" },
};

/** The activity screen's filter chips, in order. */
export const ACTIVITY_CHIPS = [
  { value: "all", label: "Everything", kinds: null },
  { value: "sign-ins", label: "Sign-ins", kinds: [ACTIVITY_KIND.SIGN_IN] },
  { value: "stock", label: "Stock changes", kinds: [ACTIVITY_KIND.STOCK] },
  { value: "prices", label: "Price changes", kinds: [ACTIVITY_KIND.PRICE] },
  {
    value: "accounts",
    label: "Staff accounts",
    kinds: [ACTIVITY_KIND.ACCOUNT],
  },
];

/**
 * Asks the database to note this session's sign-in, once per session. Every
 * other entry in the feed is written by the database itself, in the same
 * transaction as the change it describes; the browser supplies no actor, text
 * or time for any of them.
 */
export async function recordSignIn() {
  try {
    await supabase.rpc('record_session_activity');
  } catch {
    // A failed sign-in notification must not break the authenticated session.
  }
}

/**
 * Turns a stored row into what the feed shows.
 *
 * Reads the new columns and falls back to the old ones, so rows written by the
 * legacy workspace screens — which put an event name in `title` and a sentence
 * in `description` — still render as something rather than as a blank line.
 */
export function read(row) {
  const style = KIND_STYLE[row.type] ?? KIND_STYLE[ACTIVITY_KIND.PRODUCT];
  const when = row.at || row.date || null;

  return {
    id: row.id,
    kind: row.type,
    who: row.staffName || row.title || "Somebody",
    what: `${row.description || row.title || "made a change"}${row.source === 'server' ? '' : ' (historical entry; unverified)'}`,
    subject: row.subject ?? null,
    amount: row.amount ?? null,
    at: when,
    sortKey: when ? new Date(when).getTime() || 0 : 0,
    icon: style.icon,
    tone: style.tone,
  };
}

/** Newest first. */
export function readAll(rows = []) {
  return rows.map(read).sort((a, b) => b.sortKey - a.sortKey);
}

/**
 * "TODAY" / "YESTERDAY" / "Monday, 31 August" — the date-group label the
 * activity screen puts above each run of entries.
 *
 * Grouping by day rather than printing a full date on every row is what makes
 * a long log skimmable: the eye finds the day, then the time within it.
 */
export function dayLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Earlier";

  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** "9:04 AM" — the right-aligned time on an activity row. */
export function timeLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * "Today at 9:04 AM" / "Yesterday at 4:20 PM" — the one-line timestamp the
 * dashboard feed uses, where there are no day groups to sit under.
 */
export function whenLabel(value) {
  const day = dayLabel(value);
  const time = timeLabel(value);
  if (!time) return day;
  return `${day} at ${time}`;
}

/** Groups entries into [{ label, entries }], newest day first. */
export function groupByDay(entries) {
  const groups = [];
  for (const entry of entries) {
    const label = dayLabel(entry.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}
