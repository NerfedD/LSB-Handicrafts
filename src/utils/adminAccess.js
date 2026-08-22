/**
 * Temporary admin gate.
 *
 * There's no real roles/permissions system yet — anyone who signs in with an
 * email on this allowlist is treated as an admin and let into the dashboard.
 * Replace this with a proper roles table (e.g. a `profiles.role` column
 * checked via RLS) once real user management is built.
 */
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const isAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};
