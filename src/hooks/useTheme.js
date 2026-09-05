import { useCallback, useEffect, useState } from "react";

/**
 * Light or dark, as a per-device choice.
 *
 * The handoff specifies a full dark palette "applied to the two screens staff
 * sit on all day" — the products list and the order detail. A palette with no
 * way to reach it is dead CSS, so this is the switch: three states, in the
 * account menu beside the dashboard-view preference.
 *
 *   light    always the paper canvas
 *   dark     always the warm-neutral darks
 *   system   whatever the device is set to, and it follows changes live
 *
 * PER DEVICE, NOT PER ACCOUNT, which is the opposite of the dashboard-view
 * preference and deliberate. Dashboard view is about how somebody reads and
 * travels with them; light-or-dark is about the room and the screen they happen
 * to be at — a phone in a bright yard and a desktop in a back office want
 * different answers for the same person. So it lives in localStorage rather
 * than on the staff row.
 *
 * "system" is the default because the honest starting point is the choice the
 * person already made for their device.
 */
const KEY = "lsb.theme";

const read = () => {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Safari in private mode throws rather than returning null, and an
    // unhandled throw here takes the app down before it paints.
    return "system";
  }
};

const prefersDark = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export default function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && prefersDark());
      root.classList.toggle("dark", dark);
    };

    apply();

    // Only while following the device: a live media-query listener under an
    // explicit choice would override that choice the moment the sun went down.
    if (theme !== "system" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [theme]);

  const choose = useCallback((next) => {
    setTheme(next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies for this session; it just will not be
      // remembered. Better than refusing to switch at all.
    }
  }, []);

  return [theme, choose];
}
