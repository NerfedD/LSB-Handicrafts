import { useMemo, useState } from "react";

/**
 * Paging for a list screen, with the page reset whenever the result set
 * changes size.
 *
 * THAT RESET IS THE WHOLE REASON THIS IS A HOOK rather than two useStates in
 * each screen. Filtering 148 products down to seven while sitting on page 3
 * shows an empty list — which reads as "the filter found nothing", and is how
 * somebody concludes there is nothing running low when there are seven.
 *
 * It adjusts during render rather than in an effect. An effect would paint the
 * empty page first and correct it on the next frame, which is a visible flash
 * of exactly the wrong answer; comparing against the last-seen signature while
 * rendering is React's documented way to derive state from changing input, and
 * it re-renders before anything reaches the screen.
 */
export default function usePaged(items, perPage = 12) {
  const [page, setPage] = useState(0);

  // The LENGTH, not the array. A re-render that rebuilds an equal array must
  // not bounce somebody back to page one mid-read.
  const signature = items.length;
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, pageCount - 1);

  const visible = useMemo(
    () => items.slice(safePage * perPage, safePage * perPage + perPage),
    [items, safePage, perPage]
  );

  return {
    visible,
    page: safePage,
    pageCount,
    from: items.length === 0 ? 0 : safePage * perPage + 1,
    to: Math.min(items.length, (safePage + 1) * perPage),
    total: items.length,
    // Undefined rather than a no-op when there is nowhere to go: Pager renders
    // the button disabled, so the row never changes shape at the ends of a list.
    onPrevious: safePage > 0 ? () => setPage(safePage - 1) : undefined,
    onNext: safePage < pageCount - 1 ? () => setPage(safePage + 1) : undefined,
  };
}
