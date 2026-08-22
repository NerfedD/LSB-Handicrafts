/**
 * Single source of truth for the sample staff/user records the admin screens
 * render (User Accounts, Staff Directory, Manage Account, Assign Role,
 * Activity Log).
 *
 * These are placeholder records standing in for a real `staff` table. Every
 * screen reads the same shape — { id, name, role, contactNumber, status } —
 * so a row clicked in one screen carries complete data into the next.
 */

export const ROLES = [
  "Admin",
  "Manager",
  "Sales Staff",
  "Production Staff",
  "Delivery Staff",
];

export const SAMPLE_STAFF = [
  { id: 1, name: "Maria Santos", role: "Admin", contactNumber: "09171234567", status: "Active" },
  { id: 2, name: "Juan Dela Cruz", role: "Sales Staff", contactNumber: "09281234567", status: "Active" },
  { id: 3, name: "Ramon Garcia", role: "Production Staff", contactNumber: "09391234567", status: "Blocked" },
  { id: 4, name: "Ana Reyes", role: "Delivery Staff", contactNumber: "09451234567", status: "Active" },
  { id: 5, name: "Carlos Mendoza", role: "Manager", contactNumber: "09561234567", status: "Active" },
  { id: 6, name: "Liza Villanueva", role: "Sales Staff", contactNumber: "09672345678", status: "Blocked" },
];

/**
 * Stand-in for the signed-in admin until profiles are backed by the Supabase
 * user. Same record as the first staff row.
 */
export const DEFAULT_PROFILE = SAMPLE_STAFF[0];

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
