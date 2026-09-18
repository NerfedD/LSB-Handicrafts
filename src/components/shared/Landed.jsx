import { matchesChange } from "./landing";

/**
 * The mark a saved record leaves on itself.
 *
 * WHAT THIS IS FOR. A toast is the system speaking, from the corner, about a
 * record. It names what happened and it names the record, and on a screen
 * showing one thing that is enough. On a products list of 148 rows, a staff
 * table, or a deliveries board of four columns it is not: "Delivery #2041 is
 * now on the road" is true and still leaves somebody scanning for which card
 * moved. This is the record speaking about itself, in place — a confirm-green
 * wash that blooms over that one row or card and clears, 900ms, once.
 *
 * The two are not the same news twice. The toast carries the words, the undo
 * and the "View" link; this carries the pointing finger. Either one alone
 * leaves half the confirmation missing, which is what the workshop screens
 * demonstrated first and what the rest of the app now inherits.
 *
 * WHERE IT BELONGS: a screen showing many records. It answers "which one?", so
 * a screen showing one record has no question for it to answer — a product's
 * own detail page gets the screen arrival and the toast, and no wash on top.
 * Almost every write in this app is made on a detail screen and read back on a
 * list, which is why the signal outlives the navigation between them; see
 * `markLanded` in App.jsx for how long, and why that number is the toast's.
 *
 * NOTHING HERE IS ANNOUNCED TO ASSISTIVE TECHNOLOGY, on purpose. The toast is
 * already a live region, and the row's own pill and figures already carry the
 * new state in text. A second announcement of the same fact is noise, and
 * "highlighted" is not a fact anybody needs read aloud.
 *
 * THE CHANGE SIGNAL is `{ kind, id, at }`, set by App.jsx on every successful
 * write and nothing else. Nothing branches on it — a stale value cannot change
 * what a screen does, only whether a wash it already missed would have run.
 */

/**
 * The card form: an overlay inside the card it belongs to.
 *
 * The card must NOT remount, which is why this is a separate element rather
 * than a class on the card — remounting would restart the stock bar's width
 * transition from zero, and that bar travelling from its old length to its new
 * one is half of what the confirmation is saying. The `key` gives React a fresh
 * element per change instead, so the animation runs exactly once per saved
 * write and cannot get stuck on.
 *
 * Requires a positioned ancestor. Every container in this app that is given one
 * has `relative` on it; a card that forgets will paint this over the nearest
 * ancestor that does have it, which on a phone is most of the screen.
 *
 * A `<tr>` cannot host this. It takes `landedRow` from ./landing instead, and
 * that file says why.
 */
export default function Landed({ change, kind, id }) {
  if (!matchesChange(change, kind, id)) return null;
  return <span key={change.at} aria-hidden="true" className="lsb-landed" />;
}
