/**
 * The entry landing, minus the component — see Landed.jsx for what it is for.
 *
 * Split off only because these are plain functions and that file exports a
 * component; keeping both in one file costs the whole module its fast refresh.
 * The rule they encode is one rule, so read them together.
 */

/**
 * Does this change belong to the record being drawn?
 *
 * Ids come off Postgres as numbers on some tables and strings on others, and a
 * row is keyed by whichever one its own screen happens to hold. Comparing as
 * text means a landing never silently fails to appear because a bigint arrived
 * as a string this time.
 */
export function matchesChange(change, kind, id) {
  if (!change || change.kind !== kind) return false;
  return String(change.id) === String(id);
}

/**
 * The row form of the mark: props for a `<tr>`.
 *
 * A `<tr>` cannot hold the overlay `<Landed>` renders — a stray `<span>`
 * between rows is not valid table markup, and a row has no positioning context
 * to hang one off anyway — so a row says it in the one channel it owns, its
 * background.
 *
 * ONLY A `<tr>`. The wash is an animation on `background-color`, and an
 * animation beats an ordinary declaration, so on anything that paints its own
 * surface it does not wash OVER the fill, it replaces it — and the element goes
 * transparent to the page canvas at both ends of the 900ms. A `<tr>` has no
 * background of its own to lose, which is exactly why it is the one element
 * that can take this. Everything else takes `<Landed>`.
 *
 * KEY AND CLASS COME OUT TOGETHER, because they are not separable. An animation
 * does not replay on an element that already carries its class, so without the
 * stamp in the key the mark fires on a record's first save and never on its
 * second — the failure mode that looks like it works. They come back on one
 * object so the kind and the id are written once and cannot drift apart, and
 * they go on as two props, because React refuses a spread `key`:
 *
 *   const landed = landedRow(change, "order", order.id);
 *   return <TableRow key={landed.key} className={landed.className}>…
 *
 * Take both. A `className` without the matching `key` is the silent half.
 *
 * `fallbackKey` is the key the row would have carried anyway, so a row that is
 * not the one that changed keeps its identity and React does not rebuild the
 * table underneath somebody's cursor.
 */
export function landedRow(change, kind, id, fallbackKey = id) {
  if (!matchesChange(change, kind, id)) return { key: fallbackKey };
  return { key: `${fallbackKey}-${change.at}`, className: "lsb-landed-row" };
}
