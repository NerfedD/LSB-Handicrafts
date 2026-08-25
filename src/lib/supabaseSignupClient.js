import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * A throwaway Supabase client used only for creating other people's login
 * accounts (see CreateUserAccountPage). `supabase.auth.signUp()` on the
 * normal client (src/lib/supabaseClient.js) would replace whoever's
 * currently signed in with the brand-new account — Supabase auth clients
 * only ever hold one session. This client never persists a session or
 * touches localStorage, so calling signUp() on it can't sign the admin out
 * of their own session or into the one they're creating.
 *
 * A fresh instance per call keeps it fully isolated — no shared in-memory
 * state to worry about between one admin action and the next.
 */
export function createSignupClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
