// Signs somebody in by USERNAME, without ever telling the browser an email.
//
// WHAT THIS REPLACES, AND WHY. Supabase Auth only authenticates on email, so a
// username has to become one before the password can be checked -- and at that
// moment the caller is still anonymous, so no ordinary read of `staff` is
// allowed. The app used to bridge that with public.email_for_username(), a
// SECURITY DEFINER function granted to `anon`: hand it a username, get the
// email back. schema.sql was honest that this was a trade and named the fix as
// this function.
//
// The trade was worse than it looks. The anon key ships inside the JS bundle,
// so the RPC is callable by anyone who opens the site -- and staff usernames
// are short words a person would guess on the first try. One of them is
// literally "admin". A stranger could POST a handful of guesses and walk away
// with the owner's personal email address, which is the first half of a
// phishing attempt against the account that can reach every screen in the
// system. No password was leaked and no access was granted; a working list of
// who to target was.
//
// So the resolution moves here, where the service-role key never leaves the
// server, and the browser is only ever told the outcome of a sign-in it already
// supplied the password for. A caller who does not know the password learns
// nothing at all -- not whether the username exists, not the address behind it.
//
// USERNAMES ONLY, DELIBERATELY. An identifier containing "@" is refused and
// stays on the browser's own signInWithPassword call. That is not just the
// smaller change: GoTrue rate-limits sign-in attempts per source IP, and every
// request from here carries this function's IP rather than the person's. Email
// sign-ins keep their real per-IP budget by never coming through this door, and
// what is left behind it is only the small group who type a username.
//
// ALWAYS HTTP 200. The outcome is in the body, because supabase-js turns any
// non-2xx from functions.invoke() into a FunctionsHttpError whose body has to
// be dug out of error.context. A failed sign-in is an expected answer here, not
// a transport fault, so it comes back as one that is simple to read.
import { createClient } from "jsr:@supabase/supabase-js@2";

// WHAT THIS COSTS WHEN A CLASS ALL SIGNS IN AT ONCE, which is the shape of the
// load this actually sees: not a trickle, but thirty people on one demo account
// inside the same minute.
//
// Two things used to be paid per request and are now paid per ISOLATE. Deno
// keeps a warm isolate alive between invocations, so anything built at module
// scope is built once and reused by every request that lands on it:
//
//   the clients   createClient() was called twice inside the handler. It parses
//                 the URL, builds the auth + PostgREST sub-clients and wires up
//                 fetch, on every single sign-in.
//
//   the roster    a full `select username, email from staff` per request. Six
//                 rows today, but the point is the ROUND TRIP -- thirty
//                 simultaneous sign-ins meant thirty queries for one identical
//                 answer. It is cached below for ROSTER_TTL_MS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * The one answer given to every failure that is not a system fault.
 *
 * A username nobody holds and a password that does not match return the SAME
 * body, for the same reason the old RPC's caller mapped a missing row to an
 * ordinary failed sign-in: anything else is an oracle that confirms which
 * usernames exist, which is most of what moving this off the browser was for.
 * The shape matches a real GoTrue error so the sign-in screen can map both
 * paths with one function.
 */
const WRONG = {
  error: {
    code: "invalid_credentials",
    status: 400,
    name: "AuthApiError",
    message: "Invalid login credentials",
  },
};

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Built once per isolate. Neither holds per-request state -- persistSession and
// autoRefreshToken are both off, and signInWithPassword returns the session
// rather than storing it -- so sharing them across concurrent requests is safe.
//
// The admin client holds the service key and is used for ONE thing: reading the
// username -> email roster. The password is never checked with it; see the note
// further down for why that distinction is the whole security of this function.
const admin = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(URL_, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The username -> email roster, cached per isolate.
 *
 * WHY A CACHE AND NOT A NARROWER QUERY. The obvious fix for "reads the whole
 * table" is to filter on the username, and it is the wrong one here. The table
 * is a shop's staff list -- six rows -- so the query costs the same either way
 * and the expense is the ROUND TRIP, which a filter still pays. Caching removes
 * the round trip entirely: a burst of thirty simultaneous sign-ins performs one
 * read, not thirty. (It also keeps the JS-side matching below, which is there
 * because PostgREST cannot apply lower() and .ilike would read an underscore in
 * "ana_reyes" as a wildcard.)
 *
 * THE TTL IS A STALENESS BUDGET FOR NEW ACCOUNTS. An account created in the app
 * cannot sign in until the roster is next read, so the window is how long a new
 * hire waits. Thirty seconds is short enough that nobody notices and long
 * enough to flatten any realistic sign-in burst.
 *
 * DELIBERATELY NOT REFRESHED ON A MISS, which would be the tempting way to make
 * a new account work instantly. It would make an unknown username cost a
 * database read that a known one does not, and that difference is measurable
 * from outside -- exactly the timing oracle the dummy-email path below exists
 * to close. Whether the roster is read depends only on the clock, never on what
 * was typed.
 */
const ROSTER_TTL_MS = 30_000;
type Roster = Map<string, string>;
let roster: Roster | null = null;
let rosterAt = 0;
// The read in flight, if there is one. Without this, thirty requests arriving
// on a cold isolate would each start their own query before any of them
// finished -- the cache would be populated thirty times and have saved nothing
// on precisely the burst it was added for.
let rosterInFlight: Promise<Roster> | null = null;

// Requested maximum; the server can enforce a smaller cap.
const PAGE = 500;

async function readRoster(): Promise<Roster> {
  const next: Roster = new Map();
  // Paged for the same reason the app's table loads are. A plain select stops
  // at the project's row limit and reports nothing about having done so, and a
  // username past that cap would fail to resolve to an email -- which this
  // function answers identically to a wrong password, so the person would be
  // told their details were wrong and nothing would explain why.
  let lastId: number | null = null;
  for (;;) {
    let query = admin
      .from("staff")
      .select("id, username, email")
      .order("id", { ascending: true })
      .limit(PAGE);
    if (lastId !== null) query = query.gt("id", lastId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data ?? []) {
      const name = (row.username ?? "").trim().toLowerCase();
      if (name && row.email) next.set(name, row.email);
    }
    lastId = data[data.length - 1].id;
  }
  roster = next;
  rosterAt = Date.now();
  return next;
}

function currentRoster(): Promise<Roster> {
  if (roster && Date.now() - rosterAt < ROSTER_TTL_MS) return Promise.resolve(roster);
  if (!rosterInFlight) {
    rosterInFlight = readRoster().finally(() => { rosterInFlight = null; });
  }
  return rosterInFlight;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: { message: "Use POST." } }, 405);

  let body: { identifier?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json(WRONG);
  }

  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";
  if (!identifier || !password) return json(WRONG);

  // See the note above: an email address is not this function's job.
  if (identifier.includes("@")) {
    return json({ error: { code: "use_email_path", status: 400, message: "Sign in with the email directly." } });
  }

  let known: Roster;
  try {
    known = await currentRoster();
  } catch {
    return json({ error: { code: "unavailable", status: 500, message: "Could not reach the staff list." } }, 500);
  }

  // Lower-cased on both sides, which is how the roster is keyed. The unique
  // index behind it is on lower(username), so this matches what the database
  // considers the same name.
  const matchedEmail = known.get(identifier.toLowerCase()) ?? null;

  // Deliberately NOT filtered on status. A blocked person must still get past
  // this point, so the app can show them "this account has been blocked"
  // rather than "your username is wrong" -- the same rule the old function
  // carried, and the reason it did not filter either.
  //
  // A MISS DOES NOT RETURN EARLY, and that is the difference between closing
  // this oracle and only appearing to. Returning here as soon as the username
  // failed to match made the two answers identical in content and obviously
  // different in time: measured warm over five calls each, a real username took
  // ~520ms and an unknown one ~390ms, with no overlap between the samples.
  // Anybody who can read a stopwatch can still enumerate usernames off that,
  // just more slowly, which is the whole thing this function exists to prevent.
  //
  // So a miss goes through GoTrue too, against an address that cannot exist.
  // GoTrue hashes a dummy password for an unrecognised email precisely so that
  // its own answer takes the same time as a wrong password does, and borrowing
  // that is better than trying to pad a delay here to match it.
  const emailToTry = matchedEmail ?? `${crypto.randomUUID()}@example.com`;

  // The anon client, not the admin one. The password still has to be checked by
  // GoTrue: the service key could mint a session for anybody, and using it here
  // would turn a username into a way in without a password.
  const { data, error } = await anon.auth.signInWithPassword({
    email: emailToTry,
    password,
  });

  // A miss can only ever end here, whatever GoTrue thought of the throwaway
  // address it was handed.
  if (!matchedEmail) return json(WRONG);

  if (error) {
    return json({
      error: {
        code: error.code ?? "invalid_credentials",
        status: error.status ?? 400,
        name: error.name,
        message: error.message,
      },
    });
  }

  if (!data.session || !data.user?.email) return json(WRONG);

  // The email goes back only now, to somebody who has just proved they own it.
  // The tokens are what the browser needs for setSession; nothing else about
  // the staff row is included.
  return json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: { email: data.user.email },
  });
});
