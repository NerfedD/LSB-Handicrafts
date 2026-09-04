/**
 * What happened recently.
 *
 * THIS USED TO BE FICTION. `utils/activityData.js` exported twelve hardcoded
 * entries — "Maria Santos · Logged in · August 22, 2026" — and three screens
 * read them: the dashboard panel, its "Activity Entries: 12" counter, and the
 * whole activity-log screen. Nothing ever wrote a row, so the screen looked
 * identical on every install, the counter never moved, and an administrator
 * checking who changed a price learned nothing.
 *
 * The `activity_log` table existed the whole time. This module is what puts it
 * to use: one `record()` call per meaningful action, and one `read()` that
 * turns a row into the sentence the feed prints.
 *
 * WHAT COUNTS AS MEANINGFUL. Not every write. The feed answers "what has
 * changed that I might need to know about", so it records the things somebody
 * would ask about after the fact — stock moving, prices changing, accounts
 * being created or blocked, an order being written or finished. It deliberately
 * does not record reads, navigation, or a form being opened and abandoned; a
 * feed that logs everything is a feed nobody reads.
 *
 * FAILURES ARE SWALLOWED, ON PURPOSE. `record()` never throws and never
 * reports. It is bookkeeping that happens alongside a real action, and a failed
 * log entry must not make a successful save look like a failure — the user
 * moved stock, and telling them it did not work because a note about it did not
 * save would be worse than the missing note.
 */

import { activityLogCollection } from "./storageManager";

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

let lastId = 0;

/**
 * A monotonic id.
 *
 * Every table in this app uses a plain bigint primary key with no sequence, so
 * the client picks them, and everywhere else Date.now() is enough. Not here:
 * marking an order done writes one entry for the order and one per product
 * whose stock moved, back to back, and two calls inside the same millisecond
 * would collide on the primary key. The second insert would be rejected — and
 * record() swallows failures by design, so the entry would simply vanish.
 */
function nextId() {
  const now = Date.now();
  lastId = now > lastId ? now : lastId + 1;
  return lastId;
}

/**
 * Writes one entry.
 *
 * `what` is the SENTENCE FRAGMENT that follows the person's name, lower-cased
 * and in the past tense — "changed the price of Styro Ball 4 inch to ₱120.00".
 * The feed renders "<strong>Maria Santos</strong> changed the price of…", so a
 * fragment that starts with a capital or repeats the name reads wrong.
 *
 * `subject` is a stable key for the thing acted on (an item code, an order id).
 * One record's own screen filters the feed by it, so it must be the identifier
 * rather than the display name.
 */
export async function record({ kind, who, what, subject = null, amount = null }) {
  try {
    await activityLogCollection.create({
      id: nextId(),
      type: kind,
      staffName: who || "Somebody",
      description: what,
      subject: subject === null ? null : String(subject),
      amount,
      at: new Date().toISOString(),
    });
  } catch {
    // Deliberately silent. See the note at the top of this file.
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
    what: row.description || row.title || "made a change",
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

/**
 * Stock movements for one product, newest first.
 *
 * The product detail screen's "Stock movements" table is this feed filtered to
 * the product's own item code — which is why `subject` is a key rather than a
 * name. There is no separate movements table, and inventing one would mean a
 * second place stock history could disagree with itself.
 */
export function movementsFor(itemCode, entries) {
  const key = String(itemCode ?? "");
  if (!key) return [];
  return entries.filter(
    (entry) => entry.subject === key && entry.kind === ACTIVITY_KIND.STOCK
  );
}
