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

/**
 * Who may give money back or put a price right.
 *
 * NARROWER THAN "can open an order", and deliberately so. Every other action on
 * an order is recoverable — a status can be flipped back, a driver reassigned.
 * A refund moves money out of the business and a price correction rewrites what
 * a customer was told, and neither is undone by pressing something again.
 *
 * A MANAGER AS WELL AS AN ADMIN, because the owner is not always in the shop
 * and a rule that sends every wrong price to one person is a rule that gets
 * worked around with a pen.
 *
 * This is the UI half only. The other half is the guard trigger on
 * public.orders in supabase/schema.sql, which refuses the write whatever the
 * client believes — see the note there. A hidden button is a courtesy.
 */
export const canHandleMoney = (role) => role === "Admin" || role === "Manager";

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
