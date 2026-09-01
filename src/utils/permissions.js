/**
 * Who may open which screen.
 *
 * The shape below deliberately mirrors NAV_ITEMS in layout/ManagementShell:
 * that list decides which sidebar entries render, this one decides which view
 * keys are allowed to render at all. Keeping them parallel is what stops a nav
 * item being hidden while the screen behind it stays reachable — which is
 * exactly how non-admins were getting into User Management, via the unfiltered
 * AppShell tab bar on My Profile.
 *
 * `adminOnly` in NAV_ITEMS already had its counterpart in App.jsx's route gate.
 * `hideFrom` did not: Production Staff's sidebar omits the customer and
 * supplier entries, but nothing stopped those views rendering for them if a
 * stale view key or a link added later pointed there. DENIED_BY_ROLE closes
 * that half.
 *
 * Enforcement here is client-side and therefore cosmetic on its own: the anon
 * key ships in the JS bundle, so anyone can call Supabase directly. The real
 * boundary is the RLS policies in supabase/schema.sql. This stops staff walking
 * into the wrong screen; that stops them writing what they shouldn't.
 */

export const isAdminRole = (role) => role === "Admin";

/**
 * View keys only an Admin may render. Mirrors `adminOnly` in NAV_ITEMS, plus
 * the detail and form screens those nav items lead to, which have no nav entry
 * of their own.
 */
export const ADMIN_ONLY_VIEWS = new Set([
  "accounts",
  "manage-account",
  "assign-role",
  "create",
  "activity",
  "directory",
]);

/**
 * Per-role denials, mirroring `hideFrom` in NAV_ITEMS — Production Staff's
 * designed sidebar (Figma #24) is Dashboard, Product / Item Profiles and My
 * Profile only, so the customer and supplier screens are hidden from them there
 * and unreachable here.
 */
const DENIED_BY_ROLE = {
  "Production Staff": new Set([
    "customers",
    "customer-detail",
    "customer-form",
    "suppliers",
    "supplier-detail",
    "supplier-form",
  ]),
};

/**
 * Unlisted keys are allowed, which is what leaves the pre-auth views (login,
 * forgot-password, reset-password, checking-session) and the shared screens
 * (dashboard, workspace, profile, credentials, products) alone.
 */
export function canAccess(role, view) {
  if (ADMIN_ONLY_VIEWS.has(view)) return isAdminRole(role);
  return !DENIED_BY_ROLE[role]?.has(view);
}
