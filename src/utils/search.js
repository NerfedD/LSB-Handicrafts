/**
 * List search, in one place.
 *
 * Every list screen searches "the name, plus the thing printed next to the
 * name" — a SKU, a phone number, an order number. Doing it here means no screen
 * can quietly search fewer fields than its own placeholder promises, which is a
 * failure nobody reports as a bug: they just conclude the record is not there.
 *
 * Case-insensitive substring matching, deliberately. Anything cleverer —
 * fuzzy matching, ranking — makes "why did that come up" unanswerable, and
 * these lists are hundreds of rows, not millions.
 */
export function matches(query, ...fields) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => String(field ?? "").toLowerCase().includes(needle));
}

/**
 * Whether a chip, dropdown, or any other non-search control is currently
 * narrowing a list.
 *
 * `EmptyState`'s `filtered` prop needs this kept separate from search text:
 * a filter that legitimately narrows a real list to zero rows is a different
 * situation from a mistyped search, and needs different copy (see
 * PageStates.jsx). Every list screen with more than a search box should pass
 * its own filter conditions through this rather than writing the boolean
 * inline, so the convention can't quietly diverge screen to screen as more
 * filter types get added.
 */
export function hasActiveFilters(...conditions) {
  return conditions.some(Boolean);
}
