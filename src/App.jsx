import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";

import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import { canAccess, canHandleMoney, isAdminRole } from "./utils/permissions";
import { nameFromEmail } from "./utils/staffData";
import {
  activityLogCollection,
  customersCollection,
  deliveriesCollection,
  inventoryCollection,
  ordersCollection,
  productsCollection,
  saveOwnDashboardView,
  saveOwnProfile,
  staffCollection,
  suppliersCollection,
} from "./utils/storageManager";
import useIdleTimeout, { clearIdleStamp } from "./hooks/useIdleTimeout";
import useSupabaseCollection from "./hooks/useSupabaseCollection";
import { formatPeso, nowIso } from "./utils/profileFormat";
import { staffClaimsFromSession } from "./utils/sessionClaims";
import { CHROMELESS_VIEWS, metaForView, PRIMARY_ACTION } from "./utils/navigation";
import { DASHBOARD_VIEW, DELIVERY_STAGE, ORDER_STATUS } from "./utils/constants";
import { ACTIVITY_KIND, readAll, record } from "./utils/activityLog";
import { deliveryStage } from "./utils/copy";
import { commitOrder, commitPartialDelivery, handleRefundStock } from "./utils/stockLedger";
import { normalizeItems } from "./utils/orderItems";
import {
  BACKORDER_SUFFIX,
  backorderStatusOf,
  deliveryBelongsToOrder,
  deliveryForOrder,
  orderRefunded,
} from "./utils/orders";
import { stockCounts } from "./utils/productStock";
import Shell from "./components/layout/Shell";
import { NotAllowedState, NotFoundState } from "./components/shared/PageStates";
import { Toaster, toast } from "@/components/ui/sonner";

// Login is the entry point, so it stays in the initial bundle. Everything
// behind it is split out and fetched on first navigation — no signed-out
// visitor needs to download the orders workspace.
import LoginPage from "./components/LoginPage.jsx";

const ForgotPasswordPage = lazy(() => import("./components/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage"));

const DashboardPage = lazy(() => import("./components/dashboards/DashboardPage"));

const ProductListPage = lazy(() => import("./components/products/ProductListPage"));
const ProductDetailPage = lazy(() => import("./components/products/ProductDetailPage"));
const ProductFormPage = lazy(() => import("./components/products/ProductFormPage"));
const RecordMadeDialog = lazy(() => import("./components/products/RecordMadeDialog"));

const OrderListPage = lazy(() => import("./components/orders/OrderListPage"));
const OrderDetailPage = lazy(() => import("./components/orders/OrderDetailPage"));
const OrderFormPage = lazy(() => import("./components/orders/OrderFormPage"));

const DeliveryBoardPage = lazy(() => import("./components/deliveries/DeliveryBoardPage"));
const DeliveryDetailPage = lazy(() => import("./components/deliveries/DeliveryDetailPage"));
const AssignDriverDialog = lazy(() => import("./components/deliveries/AssignDriverDialog"));
const RecordDeliveredDialog = lazy(() =>
  import("./components/deliveries/RecordDeliveredDialog")
);

const RefundDialog = lazy(() => import("./components/orders/RefundDialog"));
const PriceAdjustmentDialog = lazy(() => import("./components/orders/PriceAdjustmentDialog"));

const CustomerListPage = lazy(() => import("./components/customers/CustomerListPage"));
const CustomerDetailPage = lazy(() => import("./components/customers/CustomerDetailPage"));
const CustomerFormDialog = lazy(() => import("./components/customers/CustomerFormDialog"));

const SupplierListPage = lazy(() => import("./components/suppliers/SupplierListPage"));
const SupplierDetailPage = lazy(() => import("./components/suppliers/SupplierDetailPage"));
const SupplierFormDialog = lazy(() => import("./components/suppliers/SupplierFormDialog"));

const StaffAccountsPage = lazy(() => import("./components/staff/StaffAccountsPage"));
const ManageAccountPage = lazy(() => import("./components/staff/ManageAccountPage"));
const ChangeRolePage = lazy(() => import("./components/staff/ChangeRolePage"));
const StaffDirectoryPage = lazy(() => import("./components/staff/StaffDirectoryPage"));
const ActivityLogPage = lazy(() => import("./components/staff/ActivityLogPage"));
const CreateAccountDialog = lazy(() => import("./components/staff/CreateAccountDialog"));

const MyProfilePage = lazy(() => import("./components/account/MyProfilePage"));
const EditProfilePage = lazy(() => import("./components/account/EditProfilePage"));
const ChangePasswordPage = lazy(() => import("./components/account/ChangePasswordPage"));

/**
 * Compare two email addresses.
 *
 * Case-insensitively, always. Supabase Auth lowercases what it stores and
 * returns, but a `staff` row could have been written with different casing --
 * and when that happened, the row never matched its own session and the account
 * was locked out of the whole app with no error to explain it. The database
 * predicates match on lower(email) for the same reason.
 */
const sameEmail = (a, b) =>
  !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Which list screen each record dialog belongs to — used for its route gate. */
const LIST_VIEW_OF = { customer: "customers", supplier: "suppliers" };

// How long a signed-in session survives with no interaction. Tunable per
// deployment via .env; 30 minutes if unset.
const IDLE_TIMEOUT_MS =
  (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 30) * 60_000;

/** Shown while a route chunk is still downloading, outside the shell. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-paper text-[16px] text-muted">
      Just a moment…
    </div>
  );
}

/**
 * The view-state "router" — swap this for react-router-dom once that's added.
 * Each screen's callback props (onNavigate, onBack, …) just call setView here.
 *
 * Access is gated by having a `staff` row, not just a valid Supabase session:
 * signing in successfully only gets someone past LoginPage, then
 * handleLoginAttempt below looks them up by email.
 *
 * WHAT THE UI OVERHAUL CHANGED AT THIS LEVEL:
 *
 *  - ORDERS AND DELIVERIES ARE ROUTED. They were the last screens living in an
 *    unrouted workspace reachable only through a placeholder, on the old visual
 *    system. Their screens, and the writes behind them, are here now.
 *  - THE PRODUCTS SCREEN WRITES TWO TABLES. `products` is the catalogue and
 *    `inventory` is the stock ledger, and the split is a database fact nobody
 *    should be asked to care about — so one form collects both and
 *    saveProduct() below writes both.
 *  - EVERY MEANINGFUL WRITE RECORDS AN ACTIVITY ENTRY. The feed used to be
 *    twelve hardcoded fake rows; it is real now, which is only true if the
 *    writes remember to say so. See utils/activityLog.
 *  - DASHBOARD VIEW is a per-account preference read at this level and passed
 *    to the shell, because the chrome grows with it as well as the dashboard.
 */
export default function App() {
  const [view, setView] = useState("checking-session");
  const [staff, setStaff] = useState([]);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  // A failed staff read used to be indistinguishable from a slow one: the page
  // held its skeleton for ever, because `isStaffLoaded` simply never went
  // true. Every other list screen answers a failed read with an ErrorState and
  // a retry, and this is what lets the staff list do the same.
  const [staffError, setStaffError] = useState(null);
  const [sessionEmail, setSessionEmail] = useState(null);
  // The staff claims carried on the access token, when the Auth hook is
  // enabled. Used to route before the staff table has been read -- never as an
  // access decision; see utils/sessionClaims.js.
  const [sessionClaims, setSessionClaims] = useState(null);

  // Which record each detail screen is looking at. One per collection so
  // navigating between sections doesn't drag the previous selection along.
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);

  // Which dialog is open, and on what. `id: null` means adding.
  const [profileDialog, setProfileDialog] = useState(null); // { kind, id } | null
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [recordMadeFor, setRecordMadeFor] = useState(null); // productId | true | null
  const [assignDriverFor, setAssignDriverFor] = useState(null); // deliveryId | null
  // { deliveryId, toStage } — the manifest asked for when goods actually leave.
  const [recordDeliveredFor, setRecordDeliveredFor] = useState(null);
  const [refundFor, setRefundFor] = useState(null); // orderId | null
  const [adjustPriceFor, setAdjustPriceFor] = useState(null); // orderId | null
  const [busy, setBusy] = useState(false);

  // The header's second line. Screens push it up because it is usually a count
  // the shell -- which renders above the lazy boundary -- cannot know.
  const [contextLine, setContextLine] = useState("");
  // A filter a screen should open with, set by a dashboard attention button.
  const [pendingFilter, setPendingFilter] = useState(null);
  const [orderDraftFor, setOrderDraftFor] = useState(null);

  const isSignedIn = !!sessionEmail;
  const customersState = useSupabaseCollection(customersCollection, { enabled: isSignedIn });
  const productsState = useSupabaseCollection(productsCollection, { enabled: isSignedIn });
  const suppliersState = useSupabaseCollection(suppliersCollection, { enabled: isSignedIn });
  const inventoryState = useSupabaseCollection(inventoryCollection, { enabled: isSignedIn });
  const ordersState = useSupabaseCollection(ordersCollection, { enabled: isSignedIn });
  const deliveriesState = useSupabaseCollection(deliveriesCollection, { enabled: isSignedIn });
  const activityState = useSupabaseCollection(activityLogCollection, { enabled: isSignedIn });

  const { rows: customers } = customersState;
  const { rows: products } = productsState;
  const { rows: suppliers } = suppliersState;
  const { rows: inventory } = inventoryState;
  const { rows: orders } = ordersState;
  const { rows: deliveries } = deliveriesState;

  const activity = useMemo(() => readAll(activityState.rows), [activityState.rows]);

  // Derived so they always reflect the latest edit rather than a stale copy.
  const selectedAccount = staff.find((s) => s.id === selectedAccountId);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId);

  /**
   * The stock half of the product being edited, so the form can seed "how many
   * on the shelf now" and the category with what is already there.
   *
   * Derived here rather than inside the form because the join lives in the data
   * layer -- see utils/productStock -- and a component reaching into a second
   * table for one field is how the two screens end up disagreeing about which
   * row belongs to which product.
   */
  const stockForSelectedProduct = useMemo(() => {
    if (!selectedProduct) return undefined;
    const row = inventory.find(
      (item) =>
        String(item.sku || "").toLowerCase() ===
        String(selectedProduct.itemCode || "").toLowerCase()
    );
    if (!row) return undefined;
    return {
      tracked: true,
      category: row.category,
      onHand: row.stock,
      threshold: row.lowStockThreshold ?? selectedProduct.lowStockThreshold,
    };
  }, [selectedProduct, inventory]);

  /**
   * The signed-in person's own staff row, matched by email. Falls back to a
   * synthesized record for the brief window before their row has been read.
   *
   * That fallback is deliberately NOT an Admin. It used to be, which meant any
   * moment the staff row couldn't be found silently promoted whoever was signed
   * in to full admin rights. An unknown role has to be the least privileged one.
   */
  const profile = useMemo(() => {
    const match = staff.find((s) => sameEmail(s.email, sessionEmail));
    if (match) return match;

    return {
      id: null,
      name: nameFromEmail(sessionEmail),
      role: sessionClaims?.role ?? null,
      contactNumber: "",
      status: sessionClaims?.status ?? "Active",
      email: sessionEmail,
      isSuperAdmin: sessionClaims?.isSuperAdmin ?? false,
      dashboardView: DASHBOARD_VIEW.STANDARD,
    };
  }, [staff, sessionEmail, sessionClaims]);

  const dashboardView = profile?.dashboardView ?? DASHBOARD_VIEW.STANDARD;

  // ---- staff loading ------------------------------------------------------

  function bootstrapAdminRow(email) {
    return {
      id: Date.now(),
      name: nameFromEmail(email),
      role: "Admin",
      contactNumber: "",
      status: "Active",
      email,
      dashboardView: DASHBOARD_VIEW.STANDARD,
    };
  }

  // The in-flight staff read. Deliberately NOT started until there's a session:
  // `staff` is gated by is_active_staff(), so an anonymous read succeeds and
  // returns zero rows -- indistinguishable from a genuinely empty table.
  const staffPromiseRef = useRef(null);

  async function resolveStaff({ force = false } = {}) {
    if (isStaffLoaded && !force) return staff;
    if (force) staffPromiseRef.current = null;
    staffPromiseRef.current ??= staffCollection.load([]);
    const result = await staffPromiseRef.current;

    // A failed read hands back the empty fallback, which is indistinguishable
    // from a genuinely empty table. Leaving isStaffLoaded false keeps callers
    // from treating that emptiness as real state.
    if (!result.ok) {
      // Cleared so a retry re-reads rather than replaying the failed promise.
      staffPromiseRef.current = null;
      setStaffError(result.error ?? new Error("Could not load staff"));
      return null;
    }

    setStaffError(null);
    setStaff(result.data);
    setIsStaffLoaded(true);
    return result.data;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      const session = sessionData.session;
      const email = session?.user?.email ?? null;
      if (!email) {
        clearIdleStamp();
        setView("login");
        return;
      }

      // FAST PATH. If the Auth hook is enabled, the role travelled with the
      // session and we can route on this frame -- no table read, no blank gap,
      // no chance of flashing "not part of your job" at an admin whose row
      // simply hadn't arrived yet.
      const claims = staffClaimsFromSession(session);
      if (claims?.role) {
        if (claims.status === "Blocked") {
          clearIdleStamp();
          supabase.auth.signOut();
          setView("login");
          return;
        }
        setSessionClaims(claims);
        setSessionEmail(email);
        setView("dashboard");
        resolveStaff();
        return;
      }

      // SLOW PATH: no hook enabled, or an account with no staff row.
      const staffRows = await resolveStaff();
      if (cancelled) return;
      if (staffRows === null) {
        setView("login");
        return;
      }

      const match = staffRows.find((s) => sameEmail(s.email, email));
      if (match?.status === "Blocked") {
        clearIdleStamp();
        supabase.auth.signOut();
        setView("login");
      } else if (match) {
        setSessionEmail(email);
        setView("dashboard");
      } else if (isAdminEmail(email)) {
        setSessionEmail(email);
        setStaff((prev) => [...prev, bootstrapAdminRow(email)]);
        setView("dashboard");
      } else {
        clearIdleStamp();
        supabase.auth.signOut();
        setView("login");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The table is the authority; the claim was only a head start. Routing from a
  // JWT claim means acting on information up to an hour stale, so once the real
  // row lands it gets the final say.
  useEffect(() => {
    if (!sessionEmail || !isStaffLoaded) return;
    const match = staff.find((s) => sameEmail(s.email, sessionEmail));
    if (!match || match.status === "Blocked") {
      handleSignOut();
    }
  }, [sessionEmail, isStaffLoaded, staff]);

  // Clicking the link from the reset email brings someone back already signed
  // into a temporary recovery session — Supabase fires this when that happens.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("reset-password");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useIdleTimeout({
    enabled: !!sessionEmail,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: handleSignOut,
  });

  // ---- writes -------------------------------------------------------------

  /**
   * Records what just happened, under the signed-in person's name.
   *
   * Not awaited by its callers and never surfaced: a failed log entry must not
   * make a successful save look like it failed. See utils/activityLog.
   */
  const logActivity = useCallback(
    (entry) => record({ ...entry, who: profile?.name }),
    [profile?.name]
  );

  /** Writes one staff row, syncing local state only once the database agrees. */
  async function persistStaff(operation, optimisticApply) {
    const result = await operation();
    if (!result.ok) {
      toast.error(result.message || "That change was not saved.");
      return result;
    }
    optimisticApply?.(result);
    return result;
  }

  async function handleLoginAttempt(email) {
    clearIdleStamp();

    // FAST PATH. The token minted a moment ago already carries the role, so the
    // dashboard can open without waiting on a table read.
    const { data: sessionData } = await supabase.auth.getSession();
    const claims = staffClaimsFromSession(sessionData.session);
    if (claims?.role) {
      if (claims.status === "Blocked") return "blocked";
      setSessionClaims(claims);
      setSessionEmail(email);
      setView("dashboard");
      resolveStaff({ force: true });
      logActivity({ kind: ACTIVITY_KIND.SIGN_IN, what: "signed in" });
      return "ok";
    }

    // SLOW PATH. Forced: anything read before this sign-in was read as an
    // anonymous caller, which RLS answers with zero rows.
    const rows = (await resolveStaff({ force: true })) ?? staff;
    const match = rows.find((s) => sameEmail(s.email, email));
    if (match?.status === "Blocked") return "blocked";
    if (match) {
      setSessionEmail(email);
      setView("dashboard");
      record({ kind: ACTIVITY_KIND.SIGN_IN, who: match.name, what: "signed in" });
      return "ok";
    }
    if (isAdminEmail(email)) {
      setSessionEmail(email);
      setStaff((prev) => [...prev, bootstrapAdminRow(email)]);
      setView("dashboard");
      return "ok";
    }
    return "no-access";
  }

  async function handleSignOut() {
    clearIdleStamp();
    await supabase.auth.signOut();
    setSelectedAccountId(null);
    setSelectedCustomerId(null);
    setSelectedProductId(null);
    setSelectedSupplierId(null);
    setSelectedOrderId(null);
    setSelectedDeliveryId(null);
    setSessionEmail(null);
    setSessionClaims(null);
    setView("login");
  }

  async function updateProfile(changes) {
    const result = await saveOwnProfile({ ...profile, ...changes });
    if (!result.ok) {
      toast.error(result.message || "Your details were not saved.");
      return false;
    }
    setStaff((prev) =>
      prev.map((s) => (sameEmail(s.email, sessionEmail) ? { ...s, ...changes } : s))
    );
    return true;
  }

  async function setDashboardView(next) {
    if (next === dashboardView) return;
    // Applied locally first, then saved. This one is a display preference on
    // the caller's own row: showing it immediately and correcting on failure is
    // the right trade, where a stock count is not.
    setStaff((prev) =>
      prev.map((s) => (sameEmail(s.email, sessionEmail) ? { ...s, dashboardView: next } : s))
    );
    const result = await saveOwnDashboardView(next);
    if (!result.ok) {
      setStaff((prev) =>
        prev.map((s) =>
          sameEmail(s.email, sessionEmail) ? { ...s, dashboardView } : s
        )
      );
      toast.error(result.message || "That preference was not saved.");
    }
  }

  async function updateSelectedAccount(changes) {
    const current = staff.find((s) => s.id === selectedAccountId);
    if (!current) return false;

    const result = await persistStaff(
      () => staffCollection.update(selectedAccountId, { ...current, ...changes }),
      (r) => {
        const saved = r.data ? staffCollection.fromRow(r.data) : changes;
        setStaff((prev) =>
          prev.map((s) => (s.id === selectedAccountId ? { ...s, ...saved } : s))
        );
      }
    );
    return result.ok;
  }

  async function handleAccountCreated({ name, role, contactNumber, email, username }) {
    const result = await persistStaff(
      () =>
        staffCollection.create({
          id: Date.now(),
          name,
          role,
          contactNumber,
          status: "Active",
          email,
          username: username?.trim() || null,
        }),
      (r) => {
        if (r.data) setStaff((prev) => [...prev, staffCollection.fromRow(r.data)]);
      }
    );
    if (result.ok) {
      toast.success(`${name} can sign in now.`, {
        description: "Tell them the password you set — they can change it once they are in.",
      });
      logActivity({
        kind: ACTIVITY_KIND.ACCOUNT,
        what: `set up an account for ${name}`,
        subject: `staff:${email}`,
      });
    }
    return result.ok;
  }

  async function deleteAccount(account) {
    // The UI hides removal for your own row and for the superadmin, and the
    // database refuses both outright. These are the belt to those braces: a
    // stale render shouldn't be able to fire a request the server will reject.
    if (sameEmail(account.email, sessionEmail)) {
      toast.error("You cannot remove your own account.");
      return;
    }
    if (account.isSuperAdmin) {
      toast.error("The owner account cannot be removed.");
      return;
    }

    await persistStaff(
      () => staffCollection.remove(account.id),
      () => {
        setStaff((prev) => prev.filter((s) => s.id !== account.id));
        if (selectedAccountId === account.id) setSelectedAccountId(null);
        toast.success(`${account.name} was removed.`, {
          description: "Orders and stock records they made are untouched.",
        });
        logActivity({
          kind: ACTIVITY_KIND.ACCOUNT,
          what: `removed ${account.name}'s account`,
          subject: `staff:${account.email}`,
        });
        setView("staff");
      }
    );
  }

  // ---- customers and suppliers -------------------------------------------

  /**
   * Builds the save handler a record dialog calls on submit. Adding stamps a
   * fresh id and both dates; editing merges into the selected record and
   * touches `updatedAt` only. Returns the saved record's id.
   *
   * Ids are Date.now() because these tables use a plain bigint primary key with
   * no sequence — the client picks them.
   */
  function makeRecordSaveHandler(kind) {
    const byKind = {
      customer: [customersState, customers, setSelectedCustomerId, "customer-detail", "Customer", ACTIVITY_KIND.CUSTOMER],
      supplier: [suppliersState, suppliers, setSelectedSupplierId, "supplier-detail", "Supplier", ACTIVITY_KIND.SUPPLIER],
    };
    const [state, records, setSelectedId, detailView, label, activityKind] = byKind[kind];
    const targetId = profileDialog?.id ?? null;

    return async (values) => {
      const now = nowIso();

      if (targetId !== null) {
        const current = records.find((r) => r.id === targetId);
        const result = await state.update(targetId, { ...current, ...values, updatedAt: now });
        if (!result.ok) {
          toast.error(result.message || "Your changes were not saved.");
          return null;
        }
        setProfileDialog(null);
        toast.success(`${values.name} was updated.`);
        logActivity({
          kind: activityKind,
          what: `updated ${label.toLowerCase()} ${values.name}`,
          subject: `${kind}:${targetId}`,
        });
        return targetId;
      }

      const id = Date.now();
      const result = await state.create({ ...values, id, createdAt: now, updatedAt: now });
      if (!result.ok) {
        toast.error(result.message || "That record was not saved.");
        return null;
      }
      setSelectedId(id);
      setProfileDialog(null);
      toast.success(`${values.name} was added.`, {
        action: { label: "View", onClick: () => setView(detailView) },
      });
      logActivity({
        kind: activityKind,
        what: `added ${label.toLowerCase()} ${values.name}`,
        subject: `${kind}:${id}`,
      });
      return id;
    };
  }

  /**
   * Removes a supplier.
   *
   * ADMIN ONLY, CHECKED IN THREE PLACES and deliberately so: the detail screen
   * only renders the block for an admin, this refuses outright, and the RLS
   * policy on public.suppliers grants DELETE to is_admin() alone. The first is
   * a courtesy, the second stops a stale render firing a doomed request, and
   * only the third is the actual permission.
   *
   * Nothing in the schema references suppliers, so this orphans nothing —
   * which is why it is a real delete rather than an archived flag.
   */
  async function deleteSupplier(supplier) {
    if (!isAdminRole(profile?.role)) {
      toast.error("Only an administrator can remove a supplier.");
      return;
    }

    const result = await suppliersState.remove(supplier.id);
    if (!result.ok) {
      toast.error(result.message || "That supplier was not removed.");
      return;
    }

    if (selectedSupplierId === supplier.id) setSelectedSupplierId(null);
    toast.success(`${supplier.name} was removed.`, {
      description: "Orders and stock records are untouched.",
    });
    logActivity({
      kind: ACTIVITY_KIND.SUPPLIER,
      what: `removed supplier ${supplier.name}`,
      subject: `supplier:${supplier.id}`,
    });
    navigate("suppliers");
  }

  /**
   * Removes a customer.
   *
   * TWO GUARDS, AND THEY GUARD DIFFERENT THINGS. `is_admin()` on the RLS
   * policy stops the wrong ROLE; the open-order check here stops the wrong
   * MOMENT, and only the app can make it — `orders` links to `customers` by
   * text name with no foreign key, so a policy would need a subquery over a
   * join the schema does not model.
   *
   * That missing foreign key is also why this deletes less than it appears to:
   * past orders keep the name and stay in the list and the takings. What goes
   * is the phone number, the email and the address.
   */
  async function deleteCustomer(customer) {
    if (!isAdminRole(profile?.role)) {
      toast.error("Only an administrator can remove a customer.");
      return;
    }

    const key = String(customer.name || "").trim().toLowerCase();
    const openOrders = orders.filter(
      (order) =>
        order.status === ORDER_STATUS.PENDING &&
        String(order.customerName || "").trim().toLowerCase() === key
    );
    if (openOrders.length > 0) {
      toast.error(`${customer.name} still has an order waiting.`, {
        description: "Finish or cancel it before removing them.",
      });
      return;
    }

    const result = await customersState.remove(customer.id);
    if (!result.ok) {
      toast.error(result.message || "That customer was not removed.");
      return;
    }

    if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
    toast.success(`${customer.name} was removed.`, {
      description: "Their past orders stay in the system under their name.",
    });
    logActivity({
      kind: ACTIVITY_KIND.CUSTOMER,
      what: `removed customer ${customer.name}`,
      subject: `customer:${customer.id}`,
    });
    navigate("customers");
  }

  /**
   * Opens a record dialog. `id` is null when adding.
   *
   * The canAccess check is not belt-and-braces: these forms have no view key of
   * their own, so the denial that used to come from the route gate has to be
   * applied against the section's list view or the protection would silently
   * disappear.
   */
  function openProfileForm(kind, id = null) {
    if (!canAccess(profile?.role, LIST_VIEW_OF[kind])) return;
    setProfileDialog({ kind, id });
  }

  // ---- products (catalogue + stock, written together) ---------------------

  /**
   * Saves a product, across BOTH tables.
   *
   * `products` is the catalogue entry and `inventory` is the stock ledger; they
   * are joined on item code (see utils/productStock). One screen collects both,
   * so this writes both — otherwise "how many on the shelf now" on the add form
   * would silently go nowhere, which is precisely the kind of quiet failure the
   * write layer was rebuilt to eliminate.
   *
   * The catalogue row is written FIRST and its failure aborts: a stock row for
   * a product that does not exist is an orphan nothing can ever show.
   */
  async function saveProduct(values) {
    setBusy(true);
    const now = nowIso();
    const editing = Boolean(selectedProduct && selectedProductId !== null);

    const catalogue = {
      itemCode: values.itemCode,
      name: values.name.trim(),
      size: values.category?.trim() || null,
      unitPrice: values.unitPrice === "" ? null : Number(values.unitPrice),
      lowStockThreshold:
        values.lowStockThreshold === "" ? null : Number(values.lowStockThreshold),
      status: "Active",
      productType: values.productType,
      diameterIn: values.diameterIn === "" ? null : Number(values.diameterIn),
      thicknessIn: values.thicknessIn === "" ? null : Number(values.thicknessIn),
      lengthFt: values.lengthFt === "" ? null : Number(values.lengthFt),
      widthFt: values.widthFt === "" ? null : Number(values.widthFt),
      unit: values.unit,
      packSize: values.packSize === "" ? 1 : Number(values.packSize),
    };

    const productId = editing ? selectedProductId : Date.now();
    const result = editing
      ? await productsState.update(productId, {
          ...selectedProduct,
          ...catalogue,
          updatedAt: now,
        })
      : await productsState.create({ ...catalogue, id: productId, createdAt: now, updatedAt: now });

    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "That product was not saved.");
      return;
    }

    // The stock half. Matched on sku == itemCode, which is the join.
    const existingStock = inventory.find(
      (row) => String(row.sku || "").toLowerCase() === String(values.itemCode).toLowerCase()
    );
    const stockCount = values.stock === "" ? null : Number(values.stock);

    if (stockCount !== null || existingStock) {
      const ledger = {
        sku: values.itemCode,
        name: catalogue.name,
        category: values.category?.trim() || "Uncategorised",
        price: catalogue.unitPrice ?? 0,
        stock: stockCount ?? existingStock?.stock ?? 0,
        maxStock: existingStock?.maxStock ?? 0,
        productType: values.productType,
        diameterIn: catalogue.diameterIn,
        thicknessIn: catalogue.thicknessIn,
        lengthFt: catalogue.lengthFt,
        widthFt: catalogue.widthFt,
        unit: values.unit,
        packSize: catalogue.packSize,
        lowStockThreshold: catalogue.lowStockThreshold ?? 0,
        reserved: existingStock?.reserved ?? 0,
        isCuttable: existingStock?.isCuttable ?? false,
        status: existingStock?.status ?? "In Stock",
      };

      const stockResult = existingStock
        ? await inventoryState.update(existingStock.id, { ...existingStock, ...ledger })
        : await inventoryState.create({ ...ledger, id: Date.now() + 1 });

      // The catalogue entry saved and the stock row did not. Say exactly that
      // rather than reporting a clean success or a total failure -- both would
      // be lies, and the second would have somebody re-enter a product that
      // already exists.
      if (!stockResult.ok) {
        setBusy(false);
        toast.error("The product was saved, but its shelf count was not.", {
          description: "Open the product and set the count again.",
        });
        setSelectedProductId(productId);
        setView("product-detail");
        return;
      }
    }

    setBusy(false);
    setSelectedProductId(productId);
    setView("product-detail");
    toast.success(`${catalogue.name} was saved.`, {
      action: { label: "View", onClick: () => setView("product-detail") },
    });
    logActivity({
      kind: ACTIVITY_KIND.PRODUCT,
      what: editing ? `updated ${catalogue.name}` : `added ${catalogue.name}`,
      subject: values.itemCode,
    });
  }

  /** Adds to a product's shelf count, and says so in the feed. */
  async function recordMade({ product, made }) {
    const row = inventory.find(
      (item) => String(item.sku || "").toLowerCase() === String(product.itemCode).toLowerCase()
    );
    if (!row) return false;

    const result = await inventoryState.update(row.id, {
      ...row,
      stock: (Number(row.stock) || 0) + made,
    });
    if (!result.ok) {
      toast.error(result.message || "That was not recorded.");
      return false;
    }

    toast.success(`${made} × ${product.name} added to the shelf.`);
    logActivity({
      kind: ACTIVITY_KIND.STOCK,
      what: `recorded ${made} × ${product.name} made`,
      subject: product.itemCode,
      amount: made,
    });
    return true;
  }

  // ---- orders --------------------------------------------------------------

  /** Writes the order and, when there is an address, the delivery carrying it. */
  async function saveOrder({ customerName, items, totalAmount, delivery }) {
    setBusy(true);
    const id = Date.now();

    const result = await ordersState.create({
      id,
      customerName,
      items,
      totalAmount,
      status: ORDER_STATUS.PENDING,
      createdAt: nowIso(),
      stockCommittedAt: null,
    });

    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "That order was not saved.");
      return;
    }

    if (delivery) {
      // The link between the two tables is this string. See utils/orders --
      // there is no foreign key, and the trailing "-" is load-bearing.
      const deliveryResult = await deliveriesState.create({
        id: id + 1,
        product: `Order #${id} - ${customerName}`,
        size: items.map((item) => `${item.quantity} × ${item.name}`).join(", "),
        location: delivery.location,
        amount: delivery.amount,
        status: DELIVERY_STAGE.NOT_SENT,
        driver: delivery.driver,
        dueOn: delivery.dueOn,
        createdAt: nowIso(),
      });
      if (!deliveryResult.ok) {
        toast.error("The order was written, but the delivery was not raised.", {
          description: "Raise it from the deliveries board so it does not get missed.",
        });
      }
    }

    setBusy(false);
    setSelectedOrderId(id);
    setOrderDraftFor(null);
    setView("order-detail");
    toast.success(`Order #${id} written for ${customerName}.`, {
      description: formatPeso(totalAmount),
    });
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `wrote order #${id} for ${customerName}`,
      subject: `order:${id}`,
      amount: totalAmount,
    });
  }

  /**
   * Marks an order done, which DEDUCTS STOCK — a one-way event.
   *
   * `commitOrder` stamps the order so a second press cannot deduct the same
   * goods twice; that stamp is the only thing standing between this and double
   * deduction, since no later reading of the orders array can tell whether the
   * goods have already left.
   */
  async function markOrderDone(order) {
    setBusy(true);
    const {
      inventory: nextInventory,
      items,
      stockCommittedAt,
    } = commitOrder(inventory, order);

    // Stock first. An order marked done whose stock never moved is a shelf that
    // lies; stock moved for an order that never got marked is recoverable.
    const { ok: stockOk, changed } = await persistStockChanges(nextInventory);
    if (!stockOk) {
      setBusy(false);
      toast.error("The stock could not be updated, so the order was left as it was.");
      return;
    }

    // `items` carries the per-line commit counters back with the stamp. Writing
    // one without the other would leave the order claiming stock had left while
    // its lines still read as owed — the exact disagreement stockCommittedAt
    // exists to prevent.
    const done = {
      ...order,
      items,
      status: ORDER_STATUS.COMPLETED,
      stockCommittedAt,
    };
    const result = await ordersState.update(order.id, {
      ...done,
      backorderStatus: backorderStatusOf(done),
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That order was not marked done.");
      return;
    }

    toast.success(`Order #${order.id} is done.`, {
      description: changed.length > 0 ? "Stock has been taken off the shelf." : undefined,
    });
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `marked order #${order.id} as done`,
      subject: `order:${order.id}`,
    });
    for (const row of changed) {
      const before = inventory.find((item) => item.id === row.id);
      logActivity({
        kind: ACTIVITY_KIND.STOCK,
        what: `sold ${(before?.stock ?? 0) - row.stock} × ${row.name} on order #${order.id}`,
        subject: row.sku,
        amount: row.stock - (before?.stock ?? 0),
      });
    }
  }

  /**
   * Writes the inventory rows a ledger function changed, and nothing else.
   *
   * STOCK GOES FIRST, EVERY TIME. An order recorded as sent whose stock never
   * moved is a shelf that lies to everybody who reads it; stock that moved for
   * a record that failed to save is recoverable by looking at the goods. So
   * every caller below writes the shelf, checks it, and only then touches the
   * order — and abandons the whole thing if the shelf refused.
   */
  async function persistStockChanges(nextInventory) {
    const changed = nextInventory.filter((row, index) => row !== inventory[index]);
    for (const row of changed) {
      const result = await inventoryState.update(row.id, row);
      if (!result.ok) return { ok: false, changed };
    }
    return { ok: true, changed };
  }

  /**
   * Gives money back, and puts the goods wherever the person holding them says
   * they belong.
   *
   * REFUSED HERE AS WELL AS HIDDEN ON THE SCREEN, and neither is the actual
   * permission — the guard trigger on public.orders is, and it refuses the
   * write whatever this believes. This stops a stale render firing a request
   * the server will reject; the hidden block is a courtesy.
   *
   * A FULL REFUND CANCELS THE ORDER, which is what releases anything still set
   * aside for it: reserved is derived from Pending orders, so a cancelled one
   * reserves nothing without a single number being decremented anywhere.
   */
  async function issueRefund(order, { amount, method, reason, full, lines }) {
    if (!canHandleMoney(profile?.role)) {
      toast.error("Only an administrator or a manager can give money back.");
      return false;
    }

    setBusy(true);
    const {
      inventory: nextInventory,
      items,
      scrapped,
    } = handleRefundStock(inventory, order, lines);

    const stock = await persistStockChanges(nextInventory);
    if (!stock.ok) {
      setBusy(false);
      toast.error("The stock could not be updated, so no money was given back.");
      return false;
    }

    const source = normalizeItems(order.items);
    const entry = {
      id: Date.now(),
      amount,
      refundedAt: nowIso(),
      refundedByStaffId: profile?.id ?? null,
      refundedBy: profile?.name ?? null,
      reason,
      method,
      restockedItems: lines.map((line) => ({
        productId: source[line.lineIndex]?.productId ?? null,
        name: source[line.lineIndex]?.name ?? "",
        quantity: line.units,
        disposition: line.disposition,
      })),
    };

    const refunded = { ...order, items, refundedAmount: orderRefunded(order) + amount };
    const result = await ordersState.update(order.id, {
      ...refunded,
      status: full ? ORDER_STATUS.CANCELLED : order.status,
      refundHistory: [...(order.refundHistory || []), entry],
      backorderStatus: backorderStatusOf(refunded),
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That refund was not recorded.");
      return false;
    }

    toast.success(`${formatPeso(amount)} given back on order #${order.id}.`, {
      description: full
        ? "The order is cancelled. Anything set aside for it has been released."
        : "What was put back on the shelf is on sale again.",
    });
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `gave back ${formatPeso(amount)} on order #${order.id}`,
      subject: `order:${order.id}`,
      amount,
    });
    // Waste is logged per item and separately from the refund. A month-end
    // question about how much stock is being thrown away cannot be answered
    // from a money figure.
    for (const item of scrapped) {
      logActivity({
        kind: ACTIVITY_KIND.STOCK,
        what: `wrote off ${item.units} × ${item.name} returned on order #${order.id}`,
        subject: `order:${order.id}`,
        amount: -item.units,
      });
    }
    return true;
  }

  /**
   * Puts a price right after the customer has already been told one.
   *
   * NEVER AN OVERWRITE. The old figure goes into price_adjustments beside the
   * new one, with the reason and the name of whoever changed it, and the order
   * screen prints the most recent as a banner from then on. A total that moved
   * with no record is indistinguishable from a mistake a month later.
   */
  async function adjustPrice(order, { oldTotal, newTotal, difference, reason }) {
    if (!canHandleMoney(profile?.role)) {
      toast.error("Only an administrator or a manager can change what an order costs.");
      return false;
    }

    setBusy(true);
    const entry = {
      oldTotal,
      newTotal,
      difference,
      reason,
      changedBy: profile?.name ?? "Somebody",
      changedAt: nowIso(),
    };
    const result = await ordersState.update(order.id, {
      ...order,
      totalAmount: newTotal,
      priceAdjustments: [...(order.priceAdjustments || []), entry],
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That price change was not saved.");
      return false;
    }

    const overcharged = difference < 0;
    toast.success(`Order #${order.id} is now ${formatPeso(newTotal)}.`, {
      description: overcharged
        ? `They were charged ${formatPeso(Math.abs(difference))} too much.`
        : `They owe ${formatPeso(difference)} more than they were told.`,
      // The correction and the money are two separate acts on purpose: lowering
      // a price does not by itself hand anything back, and pretending it did
      // would leave the shop believing it had paid somebody it had not.
      action: overcharged
        ? { label: "Give it back", onClick: () => setRefundFor(order.id) }
        : { label: "Print it", onClick: () => window.print() },
    });
    logActivity({
      kind: ACTIVITY_KIND.PRICE,
      what: `changed order #${order.id} from ${formatPeso(oldTotal)} to ${formatPeso(newTotal)}`,
      subject: `order:${order.id}`,
      amount: difference,
    });
    return true;
  }

  // ---- deliveries ----------------------------------------------------------

  /**
   * The order a delivery is carrying, or undefined for one raised by hand.
   *
   * The reverse of deliveryForOrder, and it goes through the same string
   * convention rather than a second one — see the note at the top of
   * utils/orders. A backorder run keeps the same prefix, so it finds its order
   * exactly as the original does.
   */
  const orderForDelivery = (delivery) =>
    delivery ? orders.find((order) => deliveryBelongsToOrder(delivery, order.id)) : undefined;

  async function moveDelivery(delivery, nextStatus) {
    setBusy(true);
    const result = await deliveriesState.update(delivery.id, {
      ...delivery,
      status: nextStatus,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That delivery was not moved.");
      return;
    }

    const to = deliveryStage(nextStatus);
    toast.success(`Delivery #${delivery.id} is now ${to.label.toLowerCase()}.`);
    // Every advance writes a history entry automatically — the delivery's own
    // screen reads these back, and a log people have to maintain is a log that
    // is empty by March.
    logActivity({
      kind: ACTIVITY_KIND.DELIVERY,
      what: `moved delivery #${delivery.id} to ${to.label.toLowerCase()}`,
      subject: `delivery:${delivery.id}`,
    });
  }

  /**
   * The forward button on a delivery.
   *
   * ONE STAGE ASKS A QUESTION, AND ONLY ONE. "On the way" is the moment the
   * goods physically leave the building, which is the only moment the shelf
   * changes — so that is where the manifest opens, pre-filled with all of it.
   * Every other advance is a plain move: nothing leaves on the way from "Not
   * sent yet" to "Being made", and a dialog there would be a dialog people
   * learn to dismiss.
   *
   * A delivery raised by hand, with no order behind it, has nothing to count
   * against and falls straight through.
   */
  function advanceDelivery(delivery, nextStatus) {
    const order = orderForDelivery(delivery);
    if (nextStatus === DELIVERY_STAGE.ON_THE_WAY && order) {
      setRecordDeliveredFor({ deliveryId: delivery.id, toStage: nextStatus });
      return;
    }
    moveDelivery(delivery, nextStatus);
  }

  /**
   * Records what actually went out, deducts only that, and raises a second
   * delivery for anything left behind.
   *
   * FOUR WRITES, IN THIS ORDER, and the order is the whole design: shelf, then
   * order, then the delivery that moved, then the follow-up. Each one is only
   * attempted if the one before it landed, so a failure part-way leaves a state
   * somebody can look at and finish by hand rather than a shelf and an order
   * that disagree.
   *
   * THE FOLLOW-UP KEEPS THE SAME "Order #N - " PREFIX. That string is how an
   * order finds its deliveries — there is no foreign key — so the suffix goes
   * on the end where no matcher will trip over it. The run-to-run link is a
   * real column, because nothing forced that one to be a parsed string too.
   */
  async function recordDelivered(delivery, order, { toStage, delivered, manifest, followUp }) {
    setBusy(true);
    const {
      inventory: nextInventory,
      items,
      stockCommittedAt,
    } = commitPartialDelivery(inventory, order, delivered);

    const { ok: stockOk, changed } = await persistStockChanges(nextInventory);
    if (!stockOk) {
      setBusy(false);
      toast.error("The stock could not be updated, so the delivery was left as it was.");
      return false;
    }

    const sent = { ...order, items, stockCommittedAt };
    const orderResult = await ordersState.update(order.id, {
      ...sent,
      backorderStatus: backorderStatusOf(sent),
    });
    if (!orderResult.ok) {
      setBusy(false);
      toast.error(orderResult.message || "The order was not updated.", {
        description: "The stock has already moved, so check the shelf before trying again.",
      });
      return false;
    }

    const deliveryResult = await deliveriesState.update(delivery.id, {
      ...delivery,
      status: toStage,
      itemsManifest: manifest,
    });
    if (!deliveryResult.ok) {
      setBusy(false);
      toast.error(deliveryResult.message || "That delivery was not moved.");
      return false;
    }

    const short = manifest.filter((line) => line.backorderQty > 0);
    let raised = true;

    if (short.length > 0) {
      const followUpResult = await deliveriesState.create({
        id: Date.now(),
        product: `Order #${order.id} - ${order.customerName}${BACKORDER_SUFFIX}`,
        size: short.map((line) => `${line.backorderQty} × ${line.name}`).join(", "),
        location: delivery.location,
        // A second trip for a shortfall the shop caused is not a second charge.
        amount: 0,
        status: DELIVERY_STAGE.NOT_SENT,
        driver: followUp?.driver || null,
        dueOn: followUp?.dueOn || null,
        parentDeliveryId: delivery.id,
        itemsManifest: [],
        createdAt: nowIso(),
      });
      raised = followUpResult.ok;
    }

    setBusy(false);

    const to = deliveryStage(toStage);
    if (short.length === 0) {
      toast.success(`Delivery #${delivery.id} is now ${to.label.toLowerCase()}.`);
    } else if (raised) {
      toast.success(`Delivery #${delivery.id} went out short.`, {
        description: "A second delivery has been raised for what was left behind.",
      });
    } else {
      toast.error("What went out was recorded, but the second delivery was not raised.", {
        description: "Raise it from the deliveries board so it does not get missed.",
      });
    }

    logActivity({
      kind: ACTIVITY_KIND.DELIVERY,
      what:
        short.length === 0
          ? `sent delivery #${delivery.id} out in full`
          : `sent delivery #${delivery.id} out short by ${short
              .map((line) => `${line.backorderQty} × ${line.name}`)
              .join(", ")}`,
      subject: `delivery:${delivery.id}`,
    });
    for (const row of changed) {
      const before = inventory.find((item) => item.id === row.id);
      logActivity({
        kind: ACTIVITY_KIND.STOCK,
        what: `sent out ${(before?.stock ?? 0) - row.stock} × ${row.name} on order #${order.id}`,
        subject: row.sku,
        amount: row.stock - (before?.stock ?? 0),
      });
    }
    return true;
  }

  async function assignDriver(delivery, driver) {
    const result = await deliveriesState.update(delivery.id, { ...delivery, driver });
    if (!result.ok) {
      toast.error(result.message || "That was not saved.");
      return false;
    }
    toast.success(
      driver
        ? `${driver} is taking delivery #${delivery.id}.`
        : `Delivery #${delivery.id} has nobody assigned.`
    );
    logActivity({
      kind: ACTIVITY_KIND.DELIVERY,
      what: driver
        ? `gave delivery #${delivery.id} to ${driver}`
        : `took the driver off delivery #${delivery.id}`,
      subject: `delivery:${delivery.id}`,
    });
    return true;
  }

  // ---- navigation ----------------------------------------------------------

  const navigate = useCallback((next) => {
    setContextLine("");
    setPendingFilter(null);
    setView(next);
  }, []);

  /** A dashboard attention button: open a screen with a filter already applied. */
  const openFiltered = useCallback((target, filter) => {
    if (target === "staff" && filter === "add") {
      setView("staff");
      setIsCreateStaffOpen(true);
      return;
    }
    setContextLine("");
    setPendingFilter(filter ?? null);
    setView(target);
  }, []);

  const handleContext = useCallback((line) => setContextLine(line), []);

  // Counts for the sidebar badges. "products" is an ATTENTION count -- how many
  // need making -- which is why it paints clay rather than white.
  const navCounts = useMemo(() => {
    const stock = stockCounts(products, inventory, orders);
    return {
      products: stock.low + stock.out || undefined,
      orders: orders.filter((order) => order.status === ORDER_STATUS.PENDING).length || undefined,
      deliveries:
        deliveries.filter((delivery) => delivery.status !== DELIVERY_STAGE.ARRIVED).length ||
        undefined,
    };
  }, [products, inventory, orders, deliveries]);

  // ---- rendering -----------------------------------------------------------

  function renderView() {
    switch (view) {
      case "checking-session":
        return <RouteFallback />;

      case "login":
        return (
          <LoginPage
            onLoginAttempt={handleLoginAttempt}
            onForgotPassword={() => setView("forgot-password")}
          />
        );

      case "forgot-password":
        return <ForgotPasswordPage onBack={() => setView("login")} />;

      case "reset-password":
        // They're on a temporary recovery session — sign out so "sign in" means
        // a deliberate fresh sign-in with the new password.
        return <ResetPasswordPage onReturnToLogin={handleSignOut} />;

      case "dashboard":
        return (
          <DashboardPage
            profile={profile}
            dashboardView={dashboardView}
            products={products}
            inventory={inventory}
            orders={orders}
            deliveries={deliveries}
            customers={customers}
            suppliers={suppliers}
            staff={staff}
            activity={activity}
            onNavigate={navigate}
            onOpenFiltered={openFiltered}
            onAddProduct={() => navigate("product-form")}
            onAddCustomer={() => openProfileForm("customer")}
            onWriteOrder={() => navigate("order-form")}
            onRecordMade={() => setRecordMadeFor(true)}
            onContext={handleContext}
          />
        );

      // ---- products ----
      case "products":
        return (
          <ProductListPage
            isLoaded={productsState.isLoaded && inventoryState.isLoaded}
            loadError={productsState.error || inventoryState.error}
            onRetry={() => {
              productsState.reload();
              inventoryState.reload();
            }}
            products={products}
            inventory={inventory}
            orders={orders}
            onView={(id) => {
              setSelectedProductId(id);
              setView("product-detail");
            }}
            onEdit={(id) => {
              setSelectedProductId(id);
              setView("product-form");
            }}
            onAdd={() => {
              setSelectedProductId(null);
              navigate("product-form");
            }}
            onGoToDashboard={() => navigate("dashboard")}
            onContext={handleContext}
            initialFilter={pendingFilter}
            key={`products-${pendingFilter ?? "all"}`}
          />
        );

      case "product-detail":
        return (
          <ProductDetailPage
            product={selectedProduct}
            inventory={inventory}
            orders={orders}
            activity={activity}
            onBack={() => navigate("products")}
            onEdit={(id) => {
              setSelectedProductId(id);
              setView("product-form");
            }}
          />
        );

      case "product-form":
        return (
          <ProductFormPage
            key={selectedProductId ?? "new"}
            mode={selectedProductId ? "edit" : "add"}
            product={selectedProduct}
            stock={stockForSelectedProduct}
            takenCodes={products.map((product) => product.itemCode)}
            saving={busy}
            onSave={saveProduct}
            onCancel={() => navigate(selectedProductId ? "product-detail" : "products")}
          />
        );

      // ---- orders ----
      case "orders":
        return (
          <OrderListPage
            isLoaded={ordersState.isLoaded}
            loadError={ordersState.error}
            onRetry={ordersState.reload}
            orders={orders}
            onOpen={(id) => {
              setSelectedOrderId(id);
              setView("order-detail");
            }}
            onWriteOrder={() => navigate("order-form")}
            onGoToDashboard={() => navigate("dashboard")}
            onContext={handleContext}
            initialFilter={pendingFilter}
            key={`orders-${pendingFilter ?? "all"}`}
          />
        );

      case "order-detail":
        return (
          <OrderDetailPage
            order={selectedOrder}
            // Matched on NAME: `orders` stores customer_name as free text with
            // no customer_id. See the note in utils/customers -- it is a real
            // weakness, and fixing it is a migration rather than a restyle.
            customer={customers.find(
              (c) =>
                String(c.name || "").trim().toLowerCase() ===
                String(selectedOrder?.customerName || "").trim().toLowerCase()
            )}
            deliveries={deliveries}
            busy={busy}
            canHandleMoney={canHandleMoney(profile?.role)}
            onBack={() => navigate("orders")}
            onMarkDone={() => markOrderDone(selectedOrder)}
            onPrint={() => window.print()}
            onRefund={() => setRefundFor(selectedOrder.id)}
            onAdjustPrice={() => setAdjustPriceFor(selectedOrder.id)}
            onOpenDelivery={(id) => {
              setSelectedDeliveryId(id);
              setView("delivery-detail");
            }}
            onAssignDriver={() => {
              const delivery = deliveryForOrder(selectedOrder, deliveries);
              if (delivery) setAssignDriverFor(delivery.id);
              else
                toast.error("This order has no delivery to assign.", {
                  description: "Raise one from the deliveries board first.",
                });
            }}
          />
        );

      case "order-form":
        return (
          <OrderFormPage
            customers={customers}
            products={products}
            inventory={inventory}
            existingOrders={orders}
            customer={orderDraftFor}
            saving={busy}
            onSave={saveOrder}
            onCancel={() => {
              setOrderDraftFor(null);
              navigate("orders");
            }}
          />
        );

      // ---- deliveries ----
      case "deliveries":
        return (
          <DeliveryBoardPage
            isLoaded={deliveriesState.isLoaded}
            loadError={deliveriesState.error}
            onRetry={deliveriesState.reload}
            deliveries={deliveries}
            staff={staff}
            onOpen={(id) => {
              setSelectedDeliveryId(id);
              setView("delivery-detail");
            }}
            onGoToDashboard={() => navigate("dashboard")}
            onContext={handleContext}
            initialFilter={pendingFilter}
            key={`deliveries-${pendingFilter ?? "all"}`}
          />
        );

      case "delivery-detail":
        return (
          <DeliveryDetailPage
            delivery={selectedDelivery}
            deliveries={deliveries}
            activity={activity}
            busy={busy}
            onBack={() => navigate("deliveries")}
            // Forward can open the manifest dialog; back never does. Moving a
            // delivery backwards does not un-send goods, and asking what went
            // out at that moment would invite somebody to answer it twice.
            onMoveForward={(next) => advanceDelivery(selectedDelivery, next)}
            onMoveBack={(next) => moveDelivery(selectedDelivery, next)}
            onAssignDriver={() => setAssignDriverFor(selectedDelivery.id)}
            onOpenOrder={(id) => {
              setSelectedOrderId(id);
              setView("order-detail");
            }}
            onOpenDelivery={(id) => {
              setSelectedDeliveryId(id);
              setView("delivery-detail");
            }}
          />
        );

      // ---- customers ----
      case "customers":
        return (
          <CustomerListPage
            isLoaded={customersState.isLoaded}
            loadError={customersState.error}
            onRetry={customersState.reload}
            customers={customers}
            orders={orders}
            onView={(id) => {
              setSelectedCustomerId(id);
              setView("customer-detail");
            }}
            onAdd={() => openProfileForm("customer")}
            onGoToDashboard={() => navigate("dashboard")}
            onContext={handleContext}
            initialFilter={pendingFilter}
            key={`customers-${pendingFilter ?? "all"}`}
          />
        );

      case "customer-detail":
        return (
          <CustomerDetailPage
            customer={selectedCustomer}
            orders={orders}
            canDelete={isAdminRole(profile?.role)}
            onDelete={deleteCustomer}
            onBack={() => navigate("customers")}
            onEdit={(id) => openProfileForm("customer", id)}
            onWriteOrder={(one) => {
              setOrderDraftFor(one);
              setView("order-form");
            }}
            onOpenOrder={(id) => {
              setSelectedOrderId(id);
              setView("order-detail");
            }}
          />
        );

      // ---- suppliers ----
      case "suppliers":
        return (
          <SupplierListPage
            isLoaded={suppliersState.isLoaded}
            loadError={suppliersState.error}
            onRetry={suppliersState.reload}
            suppliers={suppliers}
            onView={(id) => {
              setSelectedSupplierId(id);
              setView("supplier-detail");
            }}
            onAdd={() => openProfileForm("supplier")}
            onGoToDashboard={() => navigate("dashboard")}
            onContext={handleContext}
          />
        );

      case "supplier-detail":
        return (
          <SupplierDetailPage
            supplier={selectedSupplier}
            canDelete={isAdminRole(profile?.role)}
            onBack={() => navigate("suppliers")}
            onEdit={(id) => openProfileForm("supplier", id)}
            onDelete={deleteSupplier}
          />
        );

      // ---- staff ----
      case "staff":
        return (
          <StaffAccountsPage
            users={staff}
            isLoaded={isStaffLoaded}
            loadError={staffError}
            onRetry={() => {
              setStaffError(null);
              resolveStaff({ force: true });
            }}
            onGoToDashboard={() => navigate("dashboard")}
            currentUserEmail={sessionEmail}
            onManage={(id) => {
              setSelectedAccountId(id);
              setView("manage-account");
            }}
            onAdd={() => setIsCreateStaffOpen(true)}
            onOpenDirectory={() => navigate("directory")}
            onOpenActivity={() => navigate("activity")}
            onContext={handleContext}
            initialFilter={pendingFilter}
            key={`staff-${pendingFilter ?? "all"}`}
          />
        );

      case "manage-account":
        if (!selectedAccount) return renderMissingAccount();
        return (
          <ManageAccountPage
            key={selectedAccount.id}
            account={selectedAccount}
            currentUserEmail={sessionEmail}
            onBack={() => navigate("staff")}
            onChangeRole={() => setView("assign-role")}
            onStatusChange={async (status) => {
              if (await updateSelectedAccount({ status })) {
                toast.success(
                  status === "Blocked"
                    ? `${selectedAccount.name} can no longer sign in.`
                    : `${selectedAccount.name} can sign in again.`,
                  {
                    description:
                      status === "Blocked"
                        ? "Their password is unchanged, so this can be undone."
                        : "Their existing password still works.",
                  }
                );
                logActivity({
                  kind: ACTIVITY_KIND.ACCOUNT,
                  what:
                    status === "Blocked"
                      ? `blocked ${selectedAccount.name} from signing in`
                      : `let ${selectedAccount.name} sign in again`,
                  subject: `staff:${selectedAccount.email}`,
                });
              }
            }}
            onSaveDetails={async (changes) => {
              if (await updateSelectedAccount(changes)) {
                toast.success(`${changes.name}'s details were saved.`);
              }
            }}
            onDelete={deleteAccount}
          />
        );

      case "assign-role":
        if (!selectedAccount) return renderMissingAccount();
        return (
          <ChangeRolePage
            account={selectedAccount}
            onBack={() => setView("manage-account")}
            onSave={async (role) => {
              // Only leave the screen if the change actually persisted.
              // Navigating first is how a rejected write used to look like a
              // successful one.
              if (await updateSelectedAccount({ role })) {
                toast.success(`${selectedAccount.name} is now ${role}.`);
                logActivity({
                  kind: ACTIVITY_KIND.ACCOUNT,
                  what: `changed what ${selectedAccount.name} does to ${role}`,
                  subject: `staff:${selectedAccount.email}`,
                });
                setView("manage-account");
              }
            }}
          />
        );

      case "directory":
        return (
          <StaffDirectoryPage
            staff={staff}
            isLoaded={isStaffLoaded}
            onBack={() => navigate("staff")}
            onContext={handleContext}
          />
        );

      case "activity":
        return (
          <ActivityLogPage
            entries={activity}
            isLoaded={activityState.isLoaded}
            onBack={() => navigate("staff")}
            onContext={handleContext}
          />
        );

      // ---- my own account ----
      case "profile":
        return (
          <MyProfilePage
            profile={profile}
            dashboardView={dashboardView}
            onEdit={() => setView("profile-edit")}
            onChangePassword={() => setView("change-password")}
            onSetDashboardView={setDashboardView}
          />
        );

      case "profile-edit":
        return (
          <EditProfilePage
            profile={profile}
            onBack={() => setView("profile")}
            onSave={async (changes) => {
              if (await updateProfile(changes)) {
                toast.success("Your details were saved.");
                setView("profile");
              }
            }}
          />
        );

      case "change-password":
        return (
          <ChangePasswordPage
            profile={profile}
            onBack={() => setView("profile")}
            onDone={() => setView("profile")}
          />
        );

      default:
        return null;
    }
  }

  /**
   * Guard for a stale account selection — the row was deleted, or a reload left
   * an id pointing at nothing.
   *
   * Renders the not-found state rather than redirecting during render:
   * navigating as a side effect of rendering is how a screen ends up in a loop,
   * and "that account is not here any more" is a better answer than silently
   * landing somewhere else.
   */
  function renderMissingAccount() {
    return <NotFoundState noun="account" onBack={() => navigate("staff")} />;
  }

  // Authorization, not decoration. Hiding a nav link only hides the link — the
  // view still renders for anyone who reaches it another way. Resolved through
  // utils/permissions, which derives from the same NAV_TREE the sidebar filters
  // on, so a hidden entry and a denied view cannot drift apart.
  //
  // Computed HERE rather than inside renderView() so a denied view never
  // reaches the router at all, and never mounts inside the shell.
  const denied = !!sessionEmail && !canAccess(profile?.role, view);
  const chromeless = CHROMELESS_VIEWS.has(view);

  if (denied) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-paper p-6">
          <div className="w-full max-w-[640px]">
            <NotAllowedState
              role={profile?.role}
              onGoToDashboard={() => setView("dashboard")}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  const meta = metaForView(view);
  const dialogs = (
    <Suspense fallback={null}>
      {/* Mounted at the root rather than inside a screen, because each is
          opened from list screens, detail screens AND dashboard actions.
          `key` forces fresh state when the target record changes. */}
      <CustomerFormDialog
        key={`customer-${profileDialog?.id ?? "new"}`}
        open={profileDialog?.kind === "customer"}
        onOpenChange={(next) => !next && setProfileDialog(null)}
        mode={profileDialog?.id == null ? "add" : "edit"}
        customer={customers.find((c) => c.id === profileDialog?.id)}
        onSave={makeRecordSaveHandler("customer")}
      />
      <SupplierFormDialog
        key={`supplier-${profileDialog?.id ?? "new"}`}
        open={profileDialog?.kind === "supplier"}
        onOpenChange={(next) => !next && setProfileDialog(null)}
        mode={profileDialog?.id == null ? "add" : "edit"}
        supplier={suppliers.find((s) => s.id === profileDialog?.id)}
        onSave={makeRecordSaveHandler("supplier")}
      />
      <CreateAccountDialog
        open={isCreateStaffOpen}
        onOpenChange={setIsCreateStaffOpen}
        onAccountCreated={handleAccountCreated}
      />
      <RecordMadeDialog
        key={`made-${recordMadeFor ?? "any"}`}
        open={recordMadeFor !== null}
        onOpenChange={(next) => !next && setRecordMadeFor(null)}
        products={products}
        inventory={inventory}
        orders={orders}
        productId={typeof recordMadeFor === "number" ? recordMadeFor : undefined}
        onSave={recordMade}
      />
      <AssignDriverDialog
        key={`driver-${assignDriverFor ?? "none"}`}
        open={assignDriverFor !== null}
        onOpenChange={(next) => !next && setAssignDriverFor(null)}
        delivery={deliveries.find((d) => d.id === assignDriverFor)}
        staff={staff}
        onSave={(driver) =>
          assignDriver(
            deliveries.find((d) => d.id === assignDriverFor),
            driver
          )
        }
      />
      <RecordDeliveredDialog
        key={`manifest-${recordDeliveredFor?.deliveryId ?? "none"}`}
        open={recordDeliveredFor !== null}
        onOpenChange={(next) => !next && setRecordDeliveredFor(null)}
        delivery={deliveries.find((d) => d.id === recordDeliveredFor?.deliveryId)}
        order={orderForDelivery(
          deliveries.find((d) => d.id === recordDeliveredFor?.deliveryId)
        )}
        toStage={recordDeliveredFor?.toStage}
        staff={staff}
        onSave={(payload) => {
          const delivery = deliveries.find((d) => d.id === recordDeliveredFor?.deliveryId);
          const order = orderForDelivery(delivery);
          if (!delivery || !order) return false;
          return recordDelivered(delivery, order, payload);
        }}
      />
      <RefundDialog
        key={`refund-${refundFor ?? "none"}`}
        open={refundFor !== null}
        onOpenChange={(next) => !next && setRefundFor(null)}
        order={orders.find((o) => o.id === refundFor)}
        onSave={(refund) => issueRefund(orders.find((o) => o.id === refundFor), refund)}
      />
      <PriceAdjustmentDialog
        key={`price-${adjustPriceFor ?? "none"}`}
        open={adjustPriceFor !== null}
        onOpenChange={(next) => !next && setAdjustPriceFor(null)}
        order={orders.find((o) => o.id === adjustPriceFor)}
        onSave={(change) =>
          adjustPrice(orders.find((o) => o.id === adjustPriceFor), change)
        }
      />
    </Suspense>
  );

  return (
    <>
      {chromeless ? (
        <Suspense fallback={<RouteFallback />}>{renderView()}</Suspense>
      ) : (
        // Mounted ONCE, outside renderView(), which is the whole point: the
        // sidebar is no longer torn down and rebuilt on every navigation. Its
        // own Suspense boundary lives inside <main>, so a lazy chunk fetch
        // never blanks the chrome.
        <Shell
          view={view}
          title={meta.title}
          contextLine={contextLine}
          profile={profile}
          navCounts={navCounts}
          alertCount={navCounts.products ?? 0}
          dashboardView={dashboardView}
          onNavigate={navigate}
          onSignOut={handleSignOut}
          onSetDashboardView={setDashboardView}
          onOpenAlerts={() =>
            openFiltered("products", navCounts.products ? "low" : "all")
          }
          onHelp={() =>
            toast.info("Ask whoever set this up for you.", {
              description:
                "Every screen also explains itself as you go — the grey text under a field is there to be read.",
            })
          }
          onPrimaryAction={() => {
            const primary = PRIMARY_ACTION[view];
            if (!primary) return;
            if (primary.view) {
              if (primary.view === "product-form") setSelectedProductId(null);
              navigate(primary.view);
              return;
            }
            if (primary.action === "add-customer") openProfileForm("customer");
            if (primary.action === "add-supplier") openProfileForm("supplier");
            if (primary.action === "add-staff") setIsCreateStaffOpen(true);
          }}
        >
          {renderView()}
        </Shell>
      )}

      {isSignedIn && dialogs}

      {/* Mounted once, at the root, so a failed write on any screen has
          somewhere to report itself. */}
      <Toaster />
    </>
  );
}
