import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in the console instead of silently breaking every data call.
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings.'
  );
}

/**
 * Where the session is kept, decided by "Keep me signed in".
 *
 * The sign-in screen has that checkbox, and it has to mean something. Supabase
 * takes `persistSession` only at client-construction time, so it cannot be
 * flipped per sign-in — but it also accepts a custom `storage`, and a storage
 * adapter CAN choose where to put the token on each write.
 *
 *   checked (the default)  localStorage  — survives closing the browser
 *   unchecked              sessionStorage — gone when the tab closes
 *
 * The preference itself lives in localStorage under its own key, so the choice
 * is remembered even when the session deliberately is not.
 *
 * Reads look in both stores, newest intent first, so a session written before
 * the preference changed is still found rather than silently dropping somebody
 * back to the login screen.
 *
 * Every access is wrapped: Safari in private mode throws on the first
 * localStorage write rather than returning null, and an unhandled throw here
 * takes down the whole app before it paints.
 */
const KEEP_KEY = 'lsb.keepSignedIn';

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** True unless somebody has explicitly unchecked the box. */
export const keepsSignedIn = () =>
  safe(() => window.localStorage.getItem(KEEP_KEY) !== 'false', true);

/** Called by the sign-in screen BEFORE it calls signInWithPassword. */
export function setKeepSignedIn(keep) {
  safe(() => window.localStorage.setItem(KEEP_KEY, keep ? 'true' : 'false'));
  // Anything already written to the store we are moving away from would
  // outlive the new preference, so it goes now rather than at the next sign-in.
  const stale = keep ? window.sessionStorage : window.localStorage;
  safe(() => {
    for (const key of Object.keys(stale)) {
      if (key.startsWith('sb-') && key.includes('auth-token')) stale.removeItem(key);
    }
  });
}

const sessionStore = {
  getItem: (key) =>
    safe(() => window.localStorage.getItem(key)) ??
    safe(() => window.sessionStorage.getItem(key)),
  setItem: (key, value) =>
    safe(() =>
      (keepsSignedIn() ? window.localStorage : window.sessionStorage).setItem(key, value)
    ),
  removeItem: (key) => {
    safe(() => window.localStorage.removeItem(key));
    safe(() => window.sessionStorage.removeItem(key));
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: sessionStore,
  },
});
