import { useEffect, useRef } from "react";

/**
 * Signs the user out after a stretch of inactivity.
 *
 * Two things shape the implementation:
 *
 * 1. The last-activity stamp lives in localStorage, not just in a ref. A ref
 *    alone would reset on every page load, so hitting F5 would defeat the
 *    timeout entirely. Keeping it in storage also means every open tab shares
 *    one clock — working in one tab keeps the others alive.
 *
 * 2. Activity handlers only write a timestamp; they never re-arm a timer. A
 *    single interval does the checking. Re-creating a setTimeout on every
 *    scroll event would be a lot of churn for no benefit.
 */

const STORAGE_KEY = "lsb.lastActivity";
const CHECK_INTERVAL_MS = 30_000;
// The stamp is allowed to lag real activity by this much — irrelevant against
// a 30-minute window, and it keeps scroll events off localStorage.
const WRITE_THROTTLE_MS = 5_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"];

function readStamp() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    // Storage can throw outright in private mode / blocked-cookie setups.
    return null;
  }
}

function writeStamp(at) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Non-fatal: the in-memory fallback below still bounds the session for
    // this tab, it just won't survive a reload.
  }
}

/**
 * Drop the stamp so the next arm starts a fresh window. Call this on sign-out
 * and on a fresh sign-in — otherwise a stale stamp left by a previous session
 * would sign the user straight back out.
 */
export function clearIdleStamp() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; see writeStamp.
  }
}

export default function useIdleTimeout({ enabled, timeoutMs, onIdle }) {
  // Held in a ref so a re-created onIdle doesn't tear down and re-arm every
  // listener on each render.
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  useEffect(() => {
    if (!enabled) return;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;

    let fired = false;
    // Mirrors the stored stamp, and stands in for it when storage is blocked.
    let lastWrite = Date.now();

    const expire = () => {
      if (fired) return;
      fired = true;
      clearIdleStamp();
      onIdleRef.current?.();
    };

    const stored = readStamp();
    if (stored === null) {
      // No clock yet (fresh sign-in, or storage unavailable) — start one now.
      writeStamp(lastWrite);
    } else if (Date.now() - stored >= timeoutMs) {
      // The window already elapsed while the app wasn't running. Don't hand
      // out a fresh one just because the page reloaded.
      expire();
      return;
    } else {
      lastWrite = stored;
    }

    const markActive = () => {
      if (fired) return;
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      writeStamp(now);
    };

    const check = () => {
      if (fired) return;
      // Re-read rather than trusting lastWrite, so activity in another tab
      // counts.
      const stamp = readStamp() ?? lastWrite;
      if (Date.now() - stamp >= timeoutMs) expire();
    };

    const onVisibility = () => {
      // Coming back to a backgrounded tab is a moment to check the clock, not
      // to extend it — someone idle for an hour in another window should land
      // on the login screen, not get a reprieve.
      if (document.visibilityState === "visible") check();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
    };
  }, [enabled, timeoutMs]);
}
