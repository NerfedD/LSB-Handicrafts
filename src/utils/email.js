/**
 * Compare two email addresses.
 *
 * Case-insensitively, always. Supabase Auth lowercases what it stores and
 * returns, but a `staff` row could have been written with different casing --
 * and when that happened, the row never matched its own session and the account
 * was locked out of the whole app with no error to explain it. The database
 * predicates match on lower(email) for the same reason.
 */
export const sameEmail = (a, b) =>
  !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
