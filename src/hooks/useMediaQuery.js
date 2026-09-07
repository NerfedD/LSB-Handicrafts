import { useState, useSyncExternalStore } from "react";

/**
 * Tracks whether a media query currently matches.
 *
 * The list screens used to render BOTH the desktop table and the mobile card
 * list on every page load and every re-render, and hide one half with a
 * `hidden tab:block` / `tab:hidden` pair of Tailwind classes. CSS decided what
 * was visible, but React still built, diffed and kept alive twice as many
 * rows -- icons, stock bars and buttons included -- as ever appeared on
 * screen. This is the one-line replacement: ask the viewport once, and mount
 * only the half that will actually be seen.
 */
export default function useMediaQuery(query) {
  const [list] = useState(() => window.matchMedia(query));
  return useSyncExternalStore(
    (onChange) => {
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => list.matches
  );
}

/** The `tab` breakpoint from tailwind.config.js -- where the two-column list layouts switch from cards to a table. */
export const TAB_QUERY = "(min-width: 834px)";
