import { AuthClient } from '@supabase/auth-js';
import { FunctionsClient } from '@supabase/functions-js';
import { PostgrestClient } from '@supabase/postgrest-js';

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

/** Every request gives up after 20 seconds rather than hanging a screen. */
const timedFetch = (input, init = {}) => {
  const timeout = AbortSignal.timeout(20_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/**
 * The Supabase client, assembled from the three parts this app uses.
 *
 * WHY NOT createClient(). @supabase/supabase-js always bundles its Realtime and
 * Storage clients -- about 85 kB of minified JavaScript in the first download,
 * parsed on every start -- and this app uses neither: it refreshes by polling
 * and stores no files. These are the same packages supabase-js wires together,
 * wired the way it wires them (see its SupabaseClient): the same auth storage
 * key, so existing sessions survive; the anon key as `apikey`; and the signed-in
 * person's token as the bearer, falling back to the key where supabase-js does.
 * If Realtime or Storage is ever needed, switch back to createClient().
 */
const base = new URL(supabaseUrl?.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`);
const CLIENT_HEADERS = { 'X-Client-Info': 'lsb-handicrafts' };

const auth = new AuthClient({
  url: new URL('auth/v1', base).href,
  headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey, ...CLIENT_HEADERS },
  storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit',
  storage: sessionStore,
  fetch: timedFetch,
});

/**
 * Adds the credentials to a request. A publishable key (sb_publishable_…) is
 * not a JWT, so Edge Functions must not receive it as a bearer token.
 */
const withAuth = ({ keyAsBearer }) => async (input, init = {}) => {
  const { data } = await auth.getSession();
  const token = data.session?.access_token ?? null;
  const headers = new Headers(init.headers);
  if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey);
  if (!headers.has('Authorization')) {
    const bearer = token ?? (keyAsBearer ? supabaseAnonKey : null);
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  }
  return timedFetch(input, { ...init, headers });
};

const isPublishableKey = /^sb_(publishable|secret)_/.test(supabaseAnonKey ?? '');
const rest = new PostgrestClient(new URL('rest/v1', base).href, {
  headers: CLIENT_HEADERS,
  schema: 'public',
  fetch: withAuth({ keyAsBearer: true }),
});
const functions = new FunctionsClient(new URL('functions/v1', base).href, {
  headers: CLIENT_HEADERS,
  customFetch: withAuth({ keyAsBearer: !isPublishableKey }),
});

/** The parts of the supabase-js client surface this app calls. */
export const supabase = {
  auth,
  functions,
  from: (relation) => rest.from(relation),
  rpc: (fn, args = {}, options) => rest.rpc(fn, args, options),
};
