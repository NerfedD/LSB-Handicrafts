// Deletes the Supabase Auth user behind a staff account.
//
// WHY THIS EXISTS AT ALL. Removing somebody from `public.staff` revokes their
// access completely -- every RLS predicate in schema.sql gates on having an
// Active row in that table, so a leftover Auth user can sign in and see
// nothing. It is not a way back in. What it IS, is a permanent squatter on
// that email address: Auth enforces uniqueness on it, so re-hiring the same
// person, or fixing a typo by re-creating the account, fails at signUp with
// "user already registered" and no administrator can clear it from the app.
//
// The same problem arrives from the other direction when creating an account:
// auth.signUp() succeeds, then the `staff` INSERT is rejected (a taken
// username, a failed policy), and the Auth user is left behind with nothing
// pointing at it.
//
// WHY IT CANNOT LIVE IN THE BROWSER. admin.deleteUser() needs the service-role
// key, which bypasses RLS entirely. Shipping that in a JS bundle would hand
// every visitor the whole database. So it runs here, where the key stays on
// the server, and the browser is only allowed to ASK.
//
// WHO MAY ASK. The caller's bearer token is verified against Auth, and then
// their staff row is read with the service key and checked for role = 'Admin'
// and status = 'Active'. The token is identity; the table is the authority.
// Deliberately NOT the staff_role JWT claim: that claim only exists once the
// custom access token hook has been switched on in the dashboard (a manual
// step -- see schema.sql), so trusting it would make this function's security
// depend on a setting it cannot see. Reading the table fails closed either way.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
 * GoTrue has no get-user-by-email, so this pages through the list and matches
 * case-insensitively -- Auth lowercases what it stores, but the staff row it is
 * being matched against might not, which is the same trap lower(email) exists
 * for everywhere in schema.sql.
 *
 * Bounded at 20 pages so a misconfiguration cannot turn one delete into an
 * unbounded crawl. This table is a shop's staff list, not a user base.
 */
async function findUserIdByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Sign in first." }, 401);
  }

  // Two clients, deliberately. The first carries the CALLER's token and is used
  // for exactly one thing: proving who they are. The second holds the service
  // key and does the work, and is never handed anything the caller said about
  // themselves.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: caller, error: callerError } = await asCaller.auth.getUser();
  if (callerError || !caller?.user?.email) {
    return json({ error: "That sign-in is no longer valid." }, 401);
  }
  const callerEmail = caller.user.email.toLowerCase();

  // The whole staff list, matched in JS rather than with a filter, and that is
  // not laziness. `.eq` would miss a row saved as 'Ana@Example.com' -- the trap
  // lower(email) exists for everywhere in schema.sql -- and `.ilike` would read
  // an underscore in an address as a single-character wildcard, so
  // 'ana_reyes@x.com' would match 'anaXreyes@x.com'. PostgREST cannot apply
  // lower() to the column, so the comparison comes back here. It is a shop's
  // staff list; the whole table is a few dozen rows.
  const { data: staffRows, error: staffError } = await admin
    .from("staff")
    .select("email, role, status, is_super_admin");

  if (staffError) return json({ error: "Could not check your account." }, 500);

  const rowFor = (email: string | null) =>
    email
      ? (staffRows ?? []).find((r) => (r.email ?? "").trim().toLowerCase() === email) ?? null
      : null;

  const callerRow = rowFor(callerEmail);
  if (!callerRow || callerRow.status !== "Active" || callerRow.role !== "Admin") {
    return json({ error: "Only an administrator can remove a sign-in." }, 403);
  }

  let body: { userId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Say which sign-in to remove." }, 400);
  }

  const targetEmail = body.email?.trim().toLowerCase() ?? null;
  let targetId = body.userId?.trim() || null;

  if (!targetId && !targetEmail) {
    return json({ error: "Say which sign-in to remove." }, 400);
  }

  // Nobody removes their own way back in, and the owner account is off limits
  // to everyone -- the same two rules the staff DELETE policy enforces on the
  // row, applied here to the credentials, so the two halves cannot disagree.
  if (targetEmail && targetEmail === callerEmail) {
    return json({ error: "You cannot remove your own sign-in." }, 400);
  }
  if (rowFor(targetEmail)?.is_super_admin) {
    return json({ error: "The owner account's sign-in cannot be removed." }, 403);
  }

  try {
    if (!targetId && targetEmail) {
      targetId = await findUserIdByEmail(admin, targetEmail);
    }

    // Nothing to delete is success, not failure. This runs as cleanup after a
    // row has already gone or a signUp has already been rolled back, and the
    // state it is asked to reach -- no Auth user for this person -- is the
    // state it found. Reporting that as an error would put a red toast under a
    // delete that worked.
    if (!targetId) return json({ ok: true, deleted: false, reason: "no-such-user" });

    if (targetId === caller.user.id) {
      return json({ error: "You cannot remove your own sign-in." }, 400);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }
    return json({ ok: true, deleted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
