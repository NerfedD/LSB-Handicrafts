/**
 * Who may do what.
 *
 * THIS IS THE COURTESY HALF. The anon key ships in the JS bundle, so anyone
 * holding a session can call Supabase directly; the real boundary is the RLS
 * policies, guard triggers and command functions in supabase/schema.sql. What
 * this file does is keep honest people out of screens and buttons that the
 * database would refuse -- and it must say the same thing the database says.
 * The table below and the role lists in schema.sql are one rule written twice;
 * README.md's permissions table is the third copy, for people.
 *
 * Screen access (canAccess) is derived from NAV_TREE in utils/navigation.js, so
 * hiding a nav entry and denying its screens are the same edit.
 */
import { ADMIN_ONLY_VIEWS, DENIED_BY_ROLE, VIEW_CAPABILITY } from "./navigation";

const MANAGERS = ["Admin", "Manager"];

export const CAPABILITIES = {
  /** Add or edit products, prices and reorder points. */
  manageCatalogue: MANAGERS,
  /** Set a shelf count to what was actually counted. */
  correctStock: MANAGERS,
  /** Write off damaged or broken stock. */
  recordDamage: [...MANAGERS, "Production Staff"],
  /** Put back stock written off by a damage record entered wrong. */
  undoDamage: MANAGERS,
  /**
   * Money and undoing: refunds, replacements, price corrections, changing an
   * order's lines, calling an order off, putting a finished order back.
   */
  handleMoney: MANAGERS,
  /**
   * Record money received against an order: sales take it at the counter and
   * drivers on the doorstep. Removing a payment entered by mistake is
   * handleMoney's (public.remove_payment).
   */
  recordPayments: [...MANAGERS, "Sales Staff", "Delivery Staff"],
  /** See customers' contact details. */
  viewCustomers: [...MANAGERS, "Sales Staff", "Delivery Staff"],
  /** Add or edit customers. */
  editCustomers: [...MANAGERS, "Sales Staff"],
  /** Add or edit suppliers, and order materials from them. */
  manageSuppliers: MANAGERS,
  /** Change the loyalty rules. */
  manageLoyalty: MANAGERS,
  /** Start, move and finish production batches. */
  makeBatches: [...MANAGERS, "Production Staff"],
  /**
   * Undo a batch's mistakes past the planning stage: cancel one already on the
   * floor, or change its counts, worker, order or notes. Stepping a batch back
   * one stage and cancelling a planned one stay with makeBatches; deleting one
   * or re-opening a finished one is removeRecords.
   */
  correctBatches: MANAGERS,
  /** The damage & yield report. */
  viewReports: MANAGERS,
  /**
   * Remove a customer, supplier, product or raw material; delete a batch or
   * supplier order entered by mistake; re-open a finished batch.
   */
  removeRecords: ["Admin"],
  /** Staff accounts and the activity log. */
  manageStaff: ["Admin"],
};

export const can = (role, capability) => CAPABILITIES[capability]?.includes(role) ?? false;

export const isAdminRole = (role) => role === "Admin";

/**
 * Unlisted views are open to every signed-in role, which leaves the pre-auth
 * views and the shared screens (dashboard, profile, products) alone.
 */
export function canAccess(role, view) {
  if (ADMIN_ONLY_VIEWS.has(view)) return isAdminRole(role);
  if (VIEW_CAPABILITY[view] && !can(role, VIEW_CAPABILITY[view])) return false;
  return !DENIED_BY_ROLE[role]?.has(view);
}
