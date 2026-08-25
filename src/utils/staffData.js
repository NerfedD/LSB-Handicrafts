/**
 * Shared shape/helpers for the staff records the admin screens render (User
 * Accounts, Staff Directory, Manage Account, Assign Role, Activity Log).
 * The records themselves live in Supabase's `staff` table — src/App.jsx
 * loads them on startup (see src/utils/storageManager.js) and passes them
 * down as props. Every screen reads the same shape — { id, name, role,
 * contactNumber, status, email } — so a row clicked in one screen carries
 * complete data into the next.
 *
 * No sample/placeholder records live here anymore: they used to double as
 * seed data the app would write into Supabase the first time the table was
 * empty, which meant fake employees ended up in the real database. Add real
 * seed rows straight in Supabase instead — ask your assistant for an INSERT
 * script, or use the SQL Editor directly.
 */

export const ROLES = [
  "Admin",
  "Manager",
  "Sales Staff",
  "Production Staff",
  "Delivery Staff",
];

/** "Maria Santos" -> "MS" */
export function initialsOf(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Best-effort display name for a staff row created the first time someone
 * signs in with an email that isn't in the `staff` table yet (see
 * src/App.jsx). "jane.doe@example.com" -> "Jane Doe". They can rename
 * themselves properly via Update Profile afterward.
 */
export function nameFromEmail(email) {
  const local = String(email || "").split("@")[0];
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
  return name || "Admin";
}
