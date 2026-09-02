/**
 * Reads the staff claims that public.custom_access_token_hook stamps onto the
 * access token.
 *
 * WHAT THIS IS FOR — and what it is NOT for.
 *
 * The app used to block its first paint on a network read of the `staff` table
 * just to learn the signed-in person's role. These claims carry that role in
 * the session itself, so routing can happen on the first frame.
 *
 * They are NOT an authorization decision. A JWT's claims are frozen when the
 * token is minted and only change when it refreshes (~1 hour), so an account
 * blocked a minute ago still presents a token saying "Active". Two things make
 * that safe:
 *
 *   1. Every RLS policy still reads the live `staff` table on every statement,
 *      so a blocked account can't read or write anything regardless of what its
 *      token claims.
 *   2. App.jsx re-checks the real row as soon as it loads and signs out anyone
 *      the claim flattered.
 *
 * So the worst a stale claim buys is a second of empty dashboard chrome before
 * being signed out — never data access.
 *
 * Everything here degrades to null if the Auth hook isn't enabled in the
 * dashboard yet, which is what keeps the old load-then-route path working.
 */

/**
 * Decodes a JWT payload. No signature check, deliberately — the server verified
 * the token before it ever reached us, and nothing here is trusted for access
 * decisions anyway (see above).
 */
function decodePayload(token) {
  try {
    const segment = String(token).split(".")[1];
    if (!segment) return null;

    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    // atob gives bytes, not characters; this round-trip is what keeps a name
    // with an accent in it from being mangled.
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @returns {{role: string|null, status: string|null, isSuperAdmin: boolean,
 *            email: string|null}|null}
 *   null when there is no session, or when the token carries no staff claims
 *   (the Auth hook is not enabled) — callers must fall back to reading the
 *   table in that case.
 */
export function staffClaimsFromSession(session) {
  if (!session?.access_token) return null;

  const payload = decodePayload(session.access_token);
  if (!payload) return null;

  // The hook always sets all three. Their absence means it isn't enabled.
  const hasClaims =
    "staff_role" in payload ||
    "staff_status" in payload ||
    "is_super_admin" in payload;
  if (!hasClaims) return null;

  return {
    role: payload.staff_role ?? null,
    status: payload.staff_status ?? null,
    isSuperAdmin: payload.is_super_admin === true,
    email: payload.email ?? null,
  };
}
