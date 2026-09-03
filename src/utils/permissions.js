/**
 * Who may open which screen.
 *
 * These rules are DERIVED from NAV_TREE in utils/navigation.js rather than
 * written out again here. They used to be a hand-maintained copy of the
 * sidebar's `adminOnly` / `hideFrom` flags, which meant the nav and the route
 * gate had to be edited in lockstep — and when they drifted, a nav item was
 * hidden while the screen behind it stayed reachable. That is exactly how
 * non-admins were getting into User Management.
 *
 * One tree now feeds both, so hiding an entry and denying its views are the
 * same edit.
 *
 * Enforcement here is client-side and therefore cosmetic on its own: the anon
 * key ships in the JS bundle, so anyone can call Supabase directly. The real
 * boundary is the RLS policies in supabase/schema.sql. This stops staff walking
 * into the wrong screen; that stops them writing what they shouldn't.
 */
import { ADMIN_ONLY_VIEWS, DENIED_BY_ROLE } from "./navigation";

export const isAdminRole = (role) => role === "Admin";

export { ADMIN_ONLY_VIEWS };

/**
 * Unlisted keys are allowed, which is what leaves the pre-auth views (login,
 * forgot-password, reset-password, checking-session) and the shared screens
 * (dashboard, workspace, profile, credentials, products) alone.
 */
export function canAccess(role, view) {
  if (ADMIN_ONLY_VIEWS.has(view)) return isAdminRole(role);
  return !DENIED_BY_ROLE[role]?.has(view);
}
