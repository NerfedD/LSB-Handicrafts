import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";

import { supabase } from "./lib/supabaseClient";
import { canAccess, canHandleMoney, isAdminRole } from "./utils/permissions";
import { nameFromEmail } from "./utils/staffData";
import {
  activityLogCollection,
  customersCollection,
  deliveriesCollection,
  deleteStaffAuthUser,
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
import { readRoute, routePath, RECORD_KEYS } from "./utils/routes";
import { provisionAccount } from "./utils/accounts";
import { createOrderCommandRunner } from "./utils/orderCommand";
import { CHROMELESS_VIEWS, metaForView, PRIMARY_ACTION } from "./utils/navigation";
import { DASHBOARD_VIEW, DELIVERY_STAGE, ORDER_STATUS } from "./utils/constants";
import { ACTIVITY_KIND, readAll, record } from "./utils/activityLog";
import { deliveryStage } from "./utils/copy";
import {
  commitOrder,
  commitPartialDelivery,
  handleRefundStock,
  outstandingOf,
  stockLines,
  uncommitOrder,
} from "./utils/stockLedger";
import { normalizeItems } from "./utils/orderItems";
import {
  BACKORDER_SUFFIX,
  backorderStatusOf,
  deliveryBelongsToOrder,
  deliveryForOrder,
  orderEditBlocker,
  orderIsEditable,
  orderRefunded,
} from "./utils/orders";
import { stockCounts, stockForProduct } from "./utils/productStock";
import { rawMaterialsCollection, rawMaterialOrdersCollection, productionBatchesCollection, productionRecipesCollection,
  productionDefectsCollection, materialLotsCollection, materialUsageCollection, workshopCommand } from './utils/workshopStorage';
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
const StartBatchDialog = lazy(() => import("./components/products/StartBatchDialog"));
const WorkshopPage = lazy(() => import("./components/production/WorkshopPage"));

/**
 * Which kind of record each workshop command hands back, so the screen knows
 * which card to mark once it is saved. Mirrors the collection map inside
 * `handleWorkshopCommand`; kept beside it deliberately, because the two are
 * wrong together or right together.
 */
/**
 * How long a saved record stays marked — see `markLanded`.
 *
 * The same 6s the confirmation toast runs for (ui/sonner.jsx), because they are
 * answering the same question and should stop answering it together. Long
 * enough to survive reading the toast and pressing Back to the list; short
 * enough that returning to a screen later is a fresh arrival rather than a
 * replay of something already acknowledged.
 */
const LANDING_WINDOW_MS = 6000;

const WORKSHOP_RECORD_KIND = {
  save_material: "material", transfer_stock: "material",
  // "material-order", not "order". A purchase from a supplier and a customer's
  // order are different records with independent id sequences, and the landing
  // signal (App state, one at a time) is matched on kind AND id — so two kinds
  // spelled the same way would let a saved supplier purchase mark whichever
  // customer order happened to share its number. The screens never sit side by
  // side today, which is exactly why the collision would have gone unnoticed.
  save_order: "material-order", order_status: "material-order",
  receive_delivery: "material-order", review_claim: "material-order",
  start_batch: "batch", batch_status: "batch",
  complete_batch: "batch", save_recipe: "recipe",
};

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
 * URL-backed view router. Session hydration restores a route without redirecting.
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
  const [initialRoute] = useState(() => readRoute(window.location));
  const [view, setView] = useState("checking-session");
  const recoveryRef = useRef(window.location.hash.includes('type=recovery'));
  const authEpoch = useRef(0);
  const staffRevision = useRef(0);
  const productRetryRef = useRef(null);
  const orderRetryRef = useRef(null);
  const orderCommands = useRef(null);
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
  const [selectedAccountId, setSelectedAccountId] = useState(initialRoute.record === "Account" ? initialRoute.id : null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialRoute.record === "Customer" ? initialRoute.id : null);
  const [selectedProductId, setSelectedProductId] = useState(initialRoute.record === "Product" ? initialRoute.id : null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialRoute.record === "Supplier" ? initialRoute.id : null);
  const [selectedOrderId, setSelectedOrderId] = useState(initialRoute.record === "Order" ? initialRoute.id : null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(initialRoute.record === "Delivery" ? initialRoute.id : null);
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState(initialRoute.record === 'RawMaterial' ? initialRoute.id : null);

  // Which dialog is open, and on what. `id: null` means adding.
  const [profileDialog, setProfileDialog] = useState(null); // { kind, id } | null
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [recordMadeFor, setRecordMadeFor] = useState(null); // { productId?, needed? } | null
  // The last record any successful write changed: { kind, id, at } | null.
  //
  // Read by every list and detail screen, to mark the row or card that just
  // moved — see shared/Landed.jsx for why a toast alone does not cover this.
  // Nothing branches on it, so a stale value cannot affect what any screen
  // DOES; the worst it can cost is a wash nobody was looking at.
  //
  // It started out as a workshop-only signal. It is one signal now because the
  // question it answers ("which of these did I just change?") is not a workshop
  // question — it is the question every list screen in this app raises by
  // showing more than one record at a time.
  const [recordChange, setRecordChange] = useState(null);

  const landedTimer = useRef(null);

  /**
   * Point the landing mark at a record.
   *
   * `at` rather than a boolean: saving the same batch twice has to read as two
   * confirmations, and a timestamp is what makes the second one a new event.
   * Called beside the toast at every successful write, never before one — the
   * mark means "this was saved", so it must not run on an optimistic update
   * that the server has not agreed to yet.
   *
   * IT HAS TO OUTLIVE THE NAVIGATION, which is the whole reason it expires on a
   * clock instead of being cleared when the view changes. Clearing on navigate
   * was right while this was a workshop-only signal, because a workshop command
   * changes a card that is already on screen. Almost nothing else in this app
   * works that way: an order is marked done on the order's own screen, a
   * delivery is advanced on the delivery's own screen, and the screen where
   * "which one?" is a real question is the list they came from and go back to.
   * A mark that died on the way there fired only where it was least needed.
   *
   * The window is the toast's own duration, deliberately. The toast is this
   * app's existing answer to "how long is this news still news", and borrowing
   * it means the sentence in the corner and the wash on the row stop being true
   * at the same moment rather than at two numbers that drifted apart.
   */
  function markLanded(kind, id) {
    if (id == null) return;
    setRecordChange({ kind, id, at: Date.now() });
    clearTimeout(landedTimer.current);
    landedTimer.current = setTimeout(() => setRecordChange(null), LANDING_WINDOW_MS);
  }

  /* A signed-out or unmounted app must not still be holding a pending clear. */
  useEffect(() => () => clearTimeout(landedTimer.current), []);

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
  const rawMaterialsState = useSupabaseCollection(rawMaterialsCollection, { enabled: isSignedIn });
  const rawMaterialOrdersState = useSupabaseCollection(rawMaterialOrdersCollection, { enabled: isSignedIn });
  const productionBatchesState = useSupabaseCollection(productionBatchesCollection, { enabled: isSignedIn });
  const productionRecipesState = useSupabaseCollection(productionRecipesCollection, { enabled: isSignedIn });
  const productionDefectsState = useSupabaseCollection(productionDefectsCollection, { enabled: isSignedIn });
  const materialLotsState = useSupabaseCollection(materialLotsCollection, { enabled: isSignedIn });
  const materialUsageState = useSupabaseCollection(materialUsageCollection, { enabled: isSignedIn });

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

  const staffPromiseRef = useRef(null);

  async function resolveStaff({ force = false } = {}) {
    if (isStaffLoaded && !force) return staff;
    const revision = staffRevision.current;
    const epoch = authEpoch.current;
    const promise = force ? staffCollection.load([]) : (staffPromiseRef.current ?? staffCollection.load([]));
    staffPromiseRef.current = promise;
    const result = await promise;
    if (staffPromiseRef.current !== promise || epoch !== authEpoch.current) return null;
    staffPromiseRef.current = null;
    if (revision !== staffRevision.current) return resolveStaff({ force: true });
    if (!result.ok) {
      setStaffError(result.error ?? new Error("Could not load staff"));
      toast.error("Staff could not be refreshed. Check the connection and try again.");
      return null;
    }
    setStaffError(null);
    setStaff(result.data);
    setIsStaffLoaded(true);
    return result.data;
  }

  useEffect(() => {
    let cancelled = false;
    const epoch = authEpoch.current;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled || epoch !== authEpoch.current) return;
        if (error) throw error;
        if (!data.session?.user?.email) {
          setView(['forgot-password', 'reset-password'].includes(initialRoute.view) ? initialRoute.view : 'login');
          return;
        }
        const email = data.session.user.email;
        const rows = await resolveStaff();
        if (cancelled || epoch !== authEpoch.current) return;
        if (!rows) { setView('login'); return; }
        const match = rows.find((row) => sameEmail(row.email, email));
        if (!match || match.status !== 'Active') {
          if (match) toast.error('This account has been suspended/blocked. Please contact an administrator.');
          await handleSignOut();
          return;
        }
        setSessionEmail(email);
        setView(recoveryRef.current ? 'reset-password' :
          CHROMELESS_VIEWS.has(initialRoute.view) ? 'dashboard' : initialRoute.view);
      } catch {
        if (!cancelled) {
          toast.error('We could not restore your session. Please sign in again.');
          setView('login');
        }
      }
    })();
    return () => { cancelled = true; };
    // Hydration runs once; navigation must never trigger a fresh login landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionEmail || !isStaffLoaded) return;
    const match = staff.find((row) => sameEmail(row.email, sessionEmail));
    if (!match || match.status !== 'Active') {
      toast.error(match ? 'This account has been suspended/blocked. Please contact an administrator.' : 'Your account access has been removed.');
      handleSignOut();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail, isStaffLoaded, staff]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setView('reset-password');
      }
      if (event === 'SIGNED_OUT') clearSession();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionEmail) return;
    const refresh = () => { if (document.visibilityState === 'visible') resolveStaff({ force: true }); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  useEffect(() => {
    const restore = () => {
      const route = readRoute(window.location);
      const setters = { Account: setSelectedAccountId, Customer: setSelectedCustomerId,
        Product: setSelectedProductId, Supplier: setSelectedSupplierId,
        Order: setSelectedOrderId, Delivery: setSelectedDeliveryId, RawMaterial: setSelectedRawMaterialId };
      if (route.record) setters[route.record](route.id);
      setPendingFilter(null);
      setView(sessionEmail ? route.view : 'login');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [sessionEmail]);

  useEffect(() => {
    if (view === 'checking-session') return;
    const ids = { Account: selectedAccountId, Customer: selectedCustomerId, Product: selectedProductId,
      Supplier: selectedSupplierId, Order: selectedOrderId, Delivery: selectedDeliveryId, RawMaterial: selectedRawMaterialId };
    const id = ids[RECORD_KEYS[view]] ?? null;
    const current = readRoute(window.location);
    if (current.view === view && current.id === id && window.location.pathname !== '/') return;
    const path = routePath(view, id);
    if (CHROMELESS_VIEWS.has(view) || CHROMELESS_VIEWS.has(current.view) || window.location.pathname === '/') {
      window.history.replaceState(null, '', path);
    } else window.history.pushState(null, '', path);
  }, [view, selectedAccountId, selectedCustomerId, selectedProductId, selectedSupplierId, selectedOrderId, selectedDeliveryId, selectedRawMaterialId]);

  useIdleTimeout({
    enabled: !!sessionEmail,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: handleSignOut,
  });

  // ---- writes -------------------------------------------------------------

  /**
   * Compatibility notification for existing action handlers. Business changes
   * are now audited by database triggers; only sign-in needs a client signal.
   */
  const logActivity = useCallback(
    (entry) => record({ ...entry, who: profile?.name }),
    [profile?.name]
  );

  /** Writes one staff row, syncing local state only once the database agrees. */
  async function persistStaff(operation, optimisticApply) {
    staffRevision.current += 1;
    const epoch = authEpoch.current;
    let result;
    try { result = await operation(); }
    catch { result = { ok: false, message: 'The request failed. Check your connection and retry.' }; }
    staffRevision.current += 1;
    if (!result.ok) {
      toast.error(result.message || "That change was not saved.");
      return result;
    }
    if (epoch !== authEpoch.current) return { ok: false, message: 'The session changed. Sign in again to check this record.' };
    optimisticApply?.(result);
    return result;
  }

  async function handleLoginAttempt(email) {
    clearIdleStamp();
    const rows = await resolveStaff({ force: true });
    if (!rows) return 'offline';
    const match = rows.find((row) => sameEmail(row.email, email));
    if (match && match.status !== 'Active') return 'blocked';
    if (!match) return 'no-access';
    window.history.replaceState(null, '', '/dashboard');
    setSessionEmail(email);
    setView('dashboard');
    record({ kind: ACTIVITY_KIND.SIGN_IN, who: match.name, what: 'signed in' });
    return 'ok';
  }

  function clearSession() {
    authEpoch.current += 1;
    staffRevision.current += 1;
    staffPromiseRef.current = null;
    clearIdleStamp();
    setStaff([]);
    setIsStaffLoaded(false);
    setStaffError(null);
    setSelectedAccountId(null);
    setSelectedCustomerId(null);
    setSelectedProductId(null);
    setSelectedSupplierId(null);
    setSelectedOrderId(null);
    setSelectedDeliveryId(null);
    setSelectedRawMaterialId(null);
    setProfileDialog(null);
    setIsCreateStaffOpen(false);
    setRecordMadeFor(null);
    setRecordChange(null);
    setAssignDriverFor(null);
    setRecordDeliveredFor(null);
    setRefundFor(null);
    setAdjustPriceFor(null);
    productRetryRef.current = null;
    orderRetryRef.current = null;
    setSessionEmail(null);
    orderCommands.current?.clear();
    setSessionClaims(null);
    setView('login');
  }

  async function handleSignOut() {
    clearSession();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) toast.error('Sign-out could not reach the server. Please try again.');
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
    // Marked here rather than at the three call sites — blocking, renaming and
    // changing a role all come through this one write, and all three land the
    // person back on the staff table looking for the row they just touched.
    if (result.ok) markLanded("account", selectedAccountId);
    return result.ok;
  }

  async function handleAccountCreated(values) {
    const { name, email } = values;
    let savedId = null;
    const result = await persistStaff(() => provisionAccount(values), (r) => {
      const saved = staffCollection.fromRow(r.data);
      savedId = saved.id;
      setStaff((prev) => [...prev.filter((row) => row.id !== saved.id), saved]);
    });
    if (result.ok) {
      toast.success(`${name} can sign in now.`, {
        description: "Tell them the password you set — they can change it once they are in.",
      });
      // The staff table sorts by name, so a new account does not arrive at the
      // bottom where somebody would look for it. The mark is what says which
      // row is theirs.
      markLanded("account", savedId);
      logActivity({
        kind: ACTIVITY_KIND.ACCOUNT,
        what: `set up an account for ${name}`,
        subject: `staff:${email}`,
      });
    }
    return result;
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

    const result = await persistStaff(
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
    if (!result.ok || !account.email) return;

    // AND THE SIGN-IN BEHIND IT. Removing the row already revoked everything --
    // every RLS predicate gates on having an Active staff row -- so this is not
    // closing an access hole. It is stopping the address squatting: Supabase
    // Auth enforces uniqueness on email, so leaving the user in place means
    // this person can never be added again, and a typo'd address is burned for
    // good. See utils/storageManager and the Edge Function it calls.
    //
    // IT DOES NOT FAIL THE DELETE. The account is gone and the person is out;
    // a leftover credential is a tidying job, not a reason to tell somebody
    // their removal did not work. So it warns, and names what is left.
    const cleanup = await deleteStaffAuthUser({ email: account.email });
    if (!cleanup.ok) {
      toast.warning("Their sign-in is still on file.", {
        description: `${account.email} cannot be used for a new account until it is removed. ${cleanup.message}`,
      });
    }
  }

  // ---- customers and suppliers -------------------------------------------

  /**
   * Builds the save handler a record dialog calls on submit. Adding stamps a
   * fresh id and both dates; editing merges into the selected record and
   * touches `updatedAt` only. Returns the saved record's id.
   *
   * Ids come back FROM the insert, not from a clock here. Every table defaults
   * its id to private.record_id_seq now, so `create` omits the column and reads
   * the assigned one off the returned row — see the note beside that sequence
   * in supabase/schema.sql for what two testers clicking Save in the same
   * millisecond used to do to each other.
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
          return result;
        }
        setProfileDialog(null);
        toast.success(`${values.name} was updated.`);
        markLanded(kind, targetId);
        logActivity({
          kind: activityKind,
          what: `updated ${label.toLowerCase()} ${values.name}`,
          subject: `${kind}:${targetId}`,
        });
        return targetId;
      }

      const result = await state.create({ ...values, createdAt: now, updatedAt: now });
      if (!result.ok) {
        toast.error(result.message || "That record was not saved.");
        return result;
      }
      const id = result.data?.id ?? null;

      // The row saved and its id did not come back, which an insert can do when
      // the new row falls outside the caller's SELECT policy. The save is still
      // a success and must be reported as one -- the dialog reads null as a
      // failure and would tell somebody to retype a record that already
      // exists. What is dropped is only what needs the number: "View" would
      // open a detail screen with nothing selected, and the activity entry
      // would be filed under a subject nothing can match.
      if (id === null) {
        setProfileDialog(null);
        toast.success(`${values.name} was added.`);
        logActivity({ kind: activityKind, what: `added ${label.toLowerCase()} ${values.name}` });
        return { ok: true };
      }

      setSelectedId(id);
      setProfileDialog(null);
      toast.success(`${values.name} was added.`, {
        action: { label: "View", onClick: () => setView(detailView) },
      });
      markLanded(kind, id);
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
   * Purchasing records retain their supplier link. Their foreign key blocks
   * deletion once a supplier has order history.
   */
  async function deleteSupplier(supplier) {
    if (!isAdminRole(profile?.role)) {
      toast.error("Only an administrator can remove a supplier.");
      return;
    }

    if (rawMaterialOrdersState.rows.some((order) => order.supplier_id === supplier.id)) {
      toast.error('Keep this supplier: their purchasing history is still on file.');
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

    // Removing somebody with an order still waiting is refused, and that check
    // has to follow the same two threads the rest of the app does -- an order
    // linked by id counts even if the name has since been corrected, and an
    // unlinked one still counts by name.
    const key = String(customer.name || "").trim().toLowerCase();
    const openOrders = orders.filter(
      (order) =>
        order.status === ORDER_STATUS.PENDING &&
        (order.customerId === customer.id ||
          (order.customerId == null &&
            String(order.customerName || "").trim().toLowerCase() === key))
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
    try {
    const now = nowIso();
    const retryProduct = productRetryRef.current;
    const editing = Boolean(selectedProduct && selectedProductId !== null) || Boolean(retryProduct);

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

    // Null on a first save: the id is the database's to assign, and comes back
    // on the returned row below.
    const knownId = retryProduct?.id ?? (editing ? selectedProductId : null);
    const result = editing
      ? await productsState.update(knownId, {
          ...selectedProduct,
          ...catalogue,
          revision: retryProduct?.revision ?? values.revision ?? 0,
          updatedAt: now,
        })
      : await productsState.create({ ...catalogue, createdAt: now, updatedAt: now });

    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "That product was not saved.");
      return result;
    }

    const productId = knownId ?? result.data?.id ?? null;

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
        ? await inventoryState.update(existingStock.id, { ...existingStock, ...ledger, revision: values.stockRevision ?? 0 })
        // No id: the sequence supplies one. The `Date.now() + 1` that stood
        // here was a hand-patch for this insert landing in the same
        // millisecond as the catalogue row above it -- which it reliably did,
        // being the very next statement.
        : await inventoryState.create(ledger);

      // The catalogue entry saved and the stock row did not. Say exactly that
      // rather than reporting a clean success or a total failure -- both would
      // be lies, and the second would have somebody re-enter a product that
      // already exists.
      if (!stockResult.ok) {
        setBusy(false);
        // Only worth remembering if there is an id to retry against; without
        // one the retry would try to update a row keyed on null.
        productRetryRef.current = productId === null ? null : { id: productId, revision: result.data?.revision ?? 0 };
        const message = `The product was saved, but its shelf count was not. ${stockResult.message || 'Check the count and save again.'}`;
        toast.error(message);
        return { ok: false, message };

      }
    }

    setBusy(false);
    productRetryRef.current = null;

    // Both halves are written; only the catalogue row's id is missing, which an
    // insert can do when the new row falls outside the caller's SELECT policy.
    // The save is reported as the success it is, but WITHOUT the jump to the
    // detail screen -- that screen is keyed on the id, so opening it with none
    // would show an empty page for a product that saved perfectly well. The
    // activity entry is unaffected: it is filed under the item code, not the id.
    if (productId === null) {
      toast.success(`${catalogue.name} was saved.`);
      logActivity({
        kind: ACTIVITY_KIND.PRODUCT,
        what: editing ? `updated ${catalogue.name}` : `added ${catalogue.name}`,
        subject: values.itemCode,
      });
      return { ok: true };
    }

    setSelectedProductId(productId);
    setView("product-detail");
    toast.success(`${catalogue.name} was saved.`, {
      action: { label: "View", onClick: () => setView("product-detail") },
    });
    markLanded("product", productId);
    logActivity({
      kind: ACTIVITY_KIND.PRODUCT,
      what: editing ? `updated ${catalogue.name}` : `added ${catalogue.name}`,
      subject: values.itemCode,
    });
    return { ok: true };
    } finally { setBusy(false); }
  }

  /**
   * Removes a product — the catalogue entry AND its stock row.
   *
   * TWO TABLES, ONE PRODUCT. saveProduct writes both, because the split between
   * a catalogue entry and its shelf count is a database fact nobody using this
   * app is asked to care about. Deleting only one half would leave a stock row
   * no screen can reach and nothing can ever edit again, so both go — catalogue
   * first, the same order saveProduct writes them in.
   *
   * ADMIN ONLY, CHECKED IN THREE PLACES, exactly as deleteSupplier is: the
   * detail screen renders the block only for an admin, this refuses outright,
   * and the RLS policies on public.products and public.inventory grant DELETE
   * to is_admin() alone. Only the last of those is the permission.
   *
   * REFUSED WHILE STOCK IS PROMISED, the way deleteCustomer refuses while an
   * order is open. `reserved` is derived from the units still owed on orders
   * that have not gone out, so anything above zero means somebody is waiting
   * for one of these — and an order pointing at a product the system has
   * forgotten how to count is not something to leave behind.
   */
  async function deleteProduct(product) {
    if (!isAdminRole(profile?.role)) {
      toast.error("Only an administrator can remove a product.");
      return;
    }

    const stock = stockForProduct(product, inventory, orders);
    if (stock.tracked && (stock.reserved ?? 0) > 0) {
      toast.error(`${product.name} is promised to an order that is still waiting.`, {
        description: "Finish or cancel that order before removing it.",
      });
      return;
    }

    const result = await productsState.remove(product.id);
    if (!result.ok) {
      toast.error(result.message || "That product was not removed.");
      return;
    }

    // The stock half, found on the same sku == itemCode join saveProduct uses.
    // A product with no stock row is an ordinary state, not a failure.
    const stockRow = inventory.find(
      (row) =>
        String(row.sku || "").toLowerCase() === String(product.itemCode || "").toLowerCase()
    );
    const stockRemoved = stockRow ? (await inventoryState.remove(stockRow.id)).ok : true;

    if (selectedProductId === product.id) setSelectedProductId(null);

    if (stockRemoved) {
      toast.success(`${product.name} was removed.`, {
        description: "Past orders keep the lines they were written with.",
      });
    } else {
      // Half a delete, reported as half a delete. Claiming a clean removal here
      // would leave a stock row in the ledger that no screen can show and
      // nobody knows about — the same reasoning as saveProduct's split failure.
      toast.error("The product was removed, but its shelf count was not.", {
        description: `The stock record against ${product.itemCode} is still in the system with nothing pointing at it.`,
      });
    }

    logActivity({
      kind: ACTIVITY_KIND.PRODUCT,
      what: `removed ${product.name}`,
      subject: product.itemCode,
    });
    navigate("products");
  }

  // The database locks the records, checks permissions and saves stock + logs
  // in one transaction. Never recreate these stock movements with client writes.
  async function handleWorkshopCommand(action, payload, requestId) {
    const result = await workshopCommand(action, payload, requestId);
    if (!result.ok) return result;
    const target = {
      save_material: rawMaterialsState, transfer_stock: rawMaterialsState,
      save_order: rawMaterialOrdersState, order_status: rawMaterialOrdersState,
      receive_delivery: rawMaterialOrdersState, review_claim: rawMaterialOrdersState,
      start_batch: productionBatchesState, batch_status: productionBatchesState,
      complete_batch: productionBatchesState, save_recipe: productionRecipesState,
    }[action];
    target?.setRows((rows) => [...rows.filter((r) => r.id !== result.data.id), result.data]);
    reloadWorkshop();
    inventoryState.reload(); activityState.reload();
    toast.success('Workshop records saved.');
    // Which record to point at, so the screen can show the entry landing on it.
    markLanded(WORKSHOP_RECORD_KIND[action], result.data.id);
    return result;
  }

  const workshopStates = [rawMaterialsState, rawMaterialOrdersState, productionBatchesState,
    productionRecipesState, productionDefectsState, materialLotsState, materialUsageState];
  function reloadWorkshop() { workshopStates.forEach((state) => state.reload()); }
  const workshopData = { materials: rawMaterialsState.rows, materialOrders: rawMaterialOrdersState.rows,
    batches: productionBatchesState.rows, recipes: productionRecipesState.rows, defects: productionDefectsState.rows,
    lots: materialLotsState.rows, usage: materialUsageState.rows, products, inventory, orders, suppliers, staff };

  // ---- orders --------------------------------------------------------------

  /** Writes the order and, when there is an address, the delivery carrying it. */
  async function saveOrder({ customerName, customerId, items, totalAmount, delivery }) {
    setBusy(true);
    try {
    // Set only on a retry, where the order row already exists and is being
    // finished rather than written again. Otherwise the id is the database's.
    const retry = orderRetryRef.current;
    const retryId = retry?.id ?? null;

    const payload = {
      customerName,
      customerId: customerId ?? null,
      items,
      totalAmount,
      status: ORDER_STATUS.PENDING,
      createdAt: nowIso(),
      stockCommittedAt: null,
      // A retry writes over the row the first attempt left behind, and that
      // update is gated on the revision the row carries. Every retry that gets
      // as far as the order bumps it, so the second one has to send what the
      // first one produced rather than the 0 the row was born with -- otherwise
      // a twice-failed delivery leaves the order unsaveable, telling somebody
      // whose form is correct that their record changed underneath them.
      ...(retryId !== null ? { revision: retry.revision ?? 0 } : {}),
    };
    const result = retryId !== null
      ? await ordersState.update(retryId, payload)
      : await ordersState.create(payload);

    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "That order was not saved.");
      return result;
    }

    const id = retryId ?? result.data?.id ?? null;

    // The order is in the table and its number is not on this screen, which
    // only an insert filtered by a SELECT policy can produce. Every line below
    // is keyed on that number -- the delivery's join string most of all -- so
    // guessing one would attach the delivery to the wrong order or to none.
    if (id === null) {
      setBusy(false);
      orderRetryRef.current = null;
      const message = "The order was saved, but its number did not come back, so the delivery was not raised. Open the order from the list to finish it.";
      toast.error(message);
      return { ok: false, message };
    }

    if (delivery) {
      // The link between the two tables is this string. See utils/orders --
      // there is no foreign key, and the trailing "-" is load-bearing.
      const deliveryResult = await deliveriesState.create({
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
        orderRetryRef.current = { id, revision: result.data?.revision ?? 0 };
        const message = `The order was saved, but the delivery was not. ${deliveryResult.message || 'Check the delivery details and save again.'}`;
        toast.error(message);
        return { ok: false, message };
      }
    }

    setBusy(false);
    orderRetryRef.current = null;
    setSelectedOrderId(id);
    setOrderDraftFor(null);
    setView("order-detail");
    toast.success(`Order #${id} written for ${customerName}.`, {
      description: formatPeso(totalAmount),
    });
    markLanded("order", id);
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `wrote order #${id} for ${customerName}`,
      subject: `order:${id}`,
      amount: totalAmount,
    });
    return { ok: true };
    } finally { setBusy(false); }
  }

  /**
   * Marks an order done, which DEDUCTS STOCK — a one-way event.
   *
   * `commitOrder` stamps the order so a second press cannot deduct the same
   * goods twice; that stamp is the only thing standing between this and double
   * deduction, since no later reading of the orders array can tell whether the
   * goods have already left.
   */
  /**
   * Rewrites an order that nothing has happened to yet.
   *
   * WHY THIS IS NARROW ON PURPOSE. Every other screen in this app can correct a
   * record; an order could not, and the workaround people found was a full
   * refund — which wrote money going back to a customer who had never paid any,
   * into the one list schema.sql calls the evidence in a disputed invoice.
   * Fixing a typo by corrupting the money record is worse than the typo.
   *
   * So the window is exactly "nothing has happened": still Waiting, no stock
   * off the shelf, nothing gone out, no refund, no price correction. See
   * orderEditBlocker in utils/orders for what each of those protects. Outside
   * that window the lines are a receipt for something real and the money path
   * is the honest route.
   *
   * ADMIN AND MANAGER ONLY, because rewriting the lines changes what the order
   * costs, and orders_guard_money_update() in the database already refuses that
   * from anybody else. Widening it here would only produce a save that the
   * server rejects — the gate belongs where the rule already is.
   *
   * RESERVED STOCK NEEDS NO FIXING, which is the quiet luxury of deriving it:
   * nothing is stored against the old lines, so replacing them re-derives every
   * count on the next read. See utils/productStock.
   */
  async function updateOrder({ customerName, customerId, items, totalAmount, delivery }) {
    const order = selectedOrder;
    if (!order) return;

    if (!canHandleMoney(profile?.role)) {
      toast.error("Only an administrator or a manager can change an order.");
      return;
    }
    const blocker = orderEditBlocker(order);
    if (blocker) {
      toast.error("This order can no longer be changed.", { description: blocker });
      return;
    }

    setBusy(true);
    const result = await ordersState.update(order.id, {
      ...order,
      customerName,
      // Re-resolved from the name that was just typed, so correcting a spelling
      // to match a real customer LINKS the order rather than leaving it adrift,
      // and retyping a walk-in's name over a linked one unlinks it honestly.
      customerId: customerId ?? null,
      items,
      totalAmount,
    });
    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "Those changes were not saved.");
      return;
    }

    // The delivery side. An order's delivery is found by the "Order #12 - Name"
    // convention (see utils/orders), so a changed customer name has to be
    // written through or the two stop pointing at each other.
    const existing = deliveryForOrder(order, deliveries);
    const summary = items.map((item) => `${item.quantity} × ${item.name}`).join(", ");
    let deliveryNote;

    if (delivery && existing) {
      const moved = await deliveriesState.update(existing.id, {
        ...existing,
        product: `Order #${order.id} - ${customerName}`,
        size: summary,
        location: delivery.location,
        amount: delivery.amount,
        driver: delivery.driver,
        dueOn: delivery.dueOn,
      });
      if (!moved.ok) deliveryNote = "The order was saved, but its delivery was not updated.";
    } else if (delivery && !existing) {
      const raised = await deliveriesState.create({
        product: `Order #${order.id} - ${customerName}`,
        size: summary,
        location: delivery.location,
        amount: delivery.amount,
        status: DELIVERY_STAGE.NOT_SENT,
        driver: delivery.driver,
        dueOn: delivery.dueOn,
        createdAt: nowIso(),
      });
      if (!raised.ok) deliveryNote = "The order was saved, but the delivery was not raised.";
    } else if (!delivery && existing) {
      // The address was cleared, so the run is not happening. Safe to remove
      // because this only runs inside the edit window — nothing has gone out,
      // so the delivery is a plan rather than a record of a journey.
      const dropped = await deliveriesState.remove(existing.id);
      if (!dropped.ok) deliveryNote = "The order was saved, but its delivery is still on the board.";
    }

    setBusy(false);
    toast[deliveryNote ? "warning" : "success"](
      deliveryNote ? "Saved, with one thing left over." : `Order #${order.id} was changed.`,
      { description: deliveryNote }
    );
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `changed order #${order.id}`,
      subject: `order:${order.id}`,
    });
    navigate("order-detail");
  }

  /**
   * Calls an order off, without pretending money moved.
   *
   * THE POINT IS WHAT IT DOES NOT WRITE. Cancelling used to mean issuing a full
   * refund, because that was the only path to a Cancelled status — so an order
   * nobody had paid for ended up with an entry in refund_history saying money
   * had gone back. That list is the evidence in a disputed invoice; filling it
   * with cancellations makes it useless for the one job it has. This writes
   * nothing to refunded_amount, refund_history or price_adjustments.
   *
   * Any goods already committed go back on the shelf — the same uncommitOrder
   * the reopen path uses — because an order that is not happening is not
   * holding stock.
   */
  async function cancelOrder(order) {
    if (!canHandleMoney(profile?.role)) {
      toast.error("Only an administrator or a manager can call an order off.");
      return;
    }
    if (order.status === ORDER_STATUS.CANCELLED) return;
    if (orderRefunded(order) > 0) {
      toast.error("Money has already gone back on this order.", {
        description: "It is part of the money record now, so it cannot simply be called off.",
      });
      return;
    }

    setBusy(true);
    const { items, deltas } = uncommitOrder(inventory, order);
    const result = await applyOrderChange("cancel", {
      orderId: order.id,
      deltas,
      order: { items, status: ORDER_STATUS.CANCELLED, stockCommittedAt: null },
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That order was not called off.");
      return;
    }
    const { changed } = result;

    // THE RUN THAT WAS GOING TO CARRY IT. A cancelled order leaving a live
    // delivery on the board is a van still scheduled for goods nobody is
    // sending -- the delivery crew works off that board and has no way of
    // knowing the order behind it is dead.
    //
    // Only a run that has NOT left is removed. Once something is on the way or
    // has arrived, the delivery is a record of a journey that really happened,
    // and a record is not ours to delete because the order was called off
    // afterwards. That one is left alone and named in the toast instead.
    const run = deliveryForOrder(order, deliveries);
    const hasLeft =
      run &&
      ([DELIVERY_STAGE.ON_THE_WAY, DELIVERY_STAGE.ARRIVED].includes(run.status) ||
        (run.itemsManifest || []).length > 0);
    let runNote;
    if (run && !hasLeft) {
      const dropped = await deliveriesState.remove(run.id);
      runNote = dropped.ok
        ? "Its delivery has come off the board too."
        : "Its delivery is still on the board — take it off there.";
    } else if (hasLeft) {
      runNote = "Its delivery stays on the board, because it already went out.";
    }

    markLanded("order", order.id);
    toast.success(`Order #${order.id} was called off.`, {
      description: [
        changed.length > 0
          ? "What it was holding has gone back on the shelf."
          : "No money was recorded as moving, because none did.",
        runNote,
      ]
        .filter(Boolean)
        .join(" "),
    });
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `called order #${order.id} off`,
      subject: `order:${order.id}`,
    });
    for (const row of changed) {
      const before = inventory.find((item) => item.id === row.id);
      logActivity({
        kind: ACTIVITY_KIND.STOCK,
        what: `put ${row.stock - (before?.stock ?? 0)} × ${row.name} back from the called-off order #${order.id}`,
        subject: row.sku,
        amount: row.stock - (before?.stock ?? 0),
      });
    }
  }

  /**
   * Puts a finished order back to Waiting, and the goods back on the shelf.
   *
   * WHY THIS EXISTS. "Mark as done" was a one-way door: every role could push
   * it, and nothing in the app could undo it. An order finished by mistake —
   * the wrong row clicked, goods that turned out not to have gone — left the
   * shelf count permanently wrong and the order permanently lying, with a
   * database edit as the only way back. uncommitOrder() has done exactly this
   * work correctly since the stock ledger was written; it simply had no caller.
   *
   * ADMIN AND MANAGER ONLY, and the same three places as every other gated
   * action: the screen shows the block only to them, this refuses outright, and
   * orders_guard_money_update() in schema.sql raises if anyone else moves an
   * order out of Completed. Only the last of those is the permission. Undoing a
   * sale is the same KIND of decision as refunding one — it moves goods and
   * contradicts what a customer was told — which is why it sits with the roles
   * that already handle money rather than with whoever wrote the order.
   *
   * Stock and order status are restored together in the database transaction.
   */
  async function reopenOrder(order) {
    if (!canHandleMoney(profile?.role)) {
      toast.error("Only an administrator or a manager can put an order back to waiting.");
      return;
    }

    setBusy(true);
    const { items, stockCommittedAt, deltas } = uncommitOrder(inventory, order);
    const reopened = { ...order, items, status: ORDER_STATUS.PENDING, stockCommittedAt };
    const result = await applyOrderChange("reopen", {
      orderId: order.id,
      deltas,
      order: {
        items,
        status: ORDER_STATUS.PENDING,
        stockCommittedAt,
        backorderStatus: backorderStatusOf(reopened),
      },
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That order was not put back.");
      return;
    }
    const { changed } = result;

    markLanded("order", order.id);
    toast.success(`Order #${order.id} is waiting again.`, {
      description:
        changed.length > 0 ? "What it took off the shelf has been put back." : undefined,
    });
    logActivity({
      kind: ACTIVITY_KIND.ORDER,
      what: `put order #${order.id} back to waiting`,
      subject: `order:${order.id}`,
    });
    for (const row of changed) {
      const before = inventory.find((item) => item.id === row.id);
      logActivity({
        kind: ACTIVITY_KIND.STOCK,
        what: `put ${row.stock - (before?.stock ?? 0)} × ${row.name} back on the shelf from order #${order.id}`,
        subject: row.sku,
        amount: row.stock - (before?.stock ?? 0),
      });
    }
  }

  async function markOrderDone(order) {
    setBusy(true);
    const { items, stockCommittedAt, deltas } = commitOrder(inventory, order);

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
    const result = await applyOrderChange("complete", {
      orderId: order.id,
      deltas,
      order: {
        items,
        status: ORDER_STATUS.COMPLETED,
        stockCommittedAt,
        backorderStatus: backorderStatusOf(done),
      },
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That order was not marked done.");
      return;
    }
    const { changed } = result;

    markLanded("order", order.id);
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
   * One order action, applied whole or not at all.
   *
   * WHAT THIS REPLACES, AND WHY IT IS NOT "STOCK FIRST" ANY MORE.
   * persistStockChanges() used to stand here, writing one inventory row at a
   * time and then leaving the caller to write the order separately. Its comment
   * argued that the shelf should move first because a shelf that lies is worse
   * than a record that failed — sound reasoning about which half to lose, and
   * the wrong question. Losing half was never necessary.
   *
   * A row refused half way through left the earlier rows committed and the
   * order unwritten, so pressing the button again deducted them a SECOND time.
   * Two people acting at once each computed an absolute total from their own
   * snapshot and the later write erased the earlier. And with `inventory` still
   * empty because it had not loaded, the loop found nothing to write, reported
   * success, and let the order be stamped done while nothing moved.
   *
   * order_command settles all of it in one transaction against locked rows, and
   * what travels is the DELTA rather than a total, so the database adds the
   * change to whatever the count truly is instead of overwriting it with a
   * stale one. There is no longer a first half to lose.
   *
   * Returns `changed` in the shape the callers already expected: the inventory
   * rows that actually moved, as saved, so the activity entries below them can
   * still say what went off which shelf.
   */
  async function applyOrderChange(action, payload) {
    const generation = authEpoch.current;
    const sourceOrder = orders.find((row) => row.id === payload.orderId);
    const sourceDelivery = deliveries.find((row) => row.id === payload.deliveryId);
    orderCommands.current ??= createOrderCommandRunner();
    const result = await orderCommands.current.run(action, {
      ...payload,
      expectedRevision: sourceOrder?.revision ?? 0,
      ...(sourceDelivery ? { expectedDeliveryRevision: sourceDelivery.revision ?? 0 } : {}),
    });
    if (generation !== authEpoch.current) return { ok: false, message: 'The session changed. Reload to check the saved record.', changed: [] };
    if (!result.ok) {
      if (result.code === '40001') {
        ordersState.reload(); deliveriesState.reload(); inventoryState.reload();
      }
      return { ok: false, message: result.message, changed: [] };
    }

    const savedOrder = result.data.order ? ordersCollection.fromRow(result.data.order) : null;
    const savedDelivery = result.data.delivery
      ? deliveriesCollection.fromRow(result.data.delivery)
      : null;
    const changed = (result.data.inventory ?? []).map(inventoryCollection.fromRow);

    // Synced from what the database actually stored rather than from what was
    // sent, so a value it adjusted — or a concurrent change it merged past — is
    // on screen immediately instead of at the next reload.
    if (savedOrder) {
      ordersState.setRows((current) => current.map((row) => (row.id === savedOrder.id ? savedOrder : row)));
    }
    if (savedDelivery) {
      deliveriesState.setRows(
        (current) => current.map((row) => (row.id === savedDelivery.id ? savedDelivery : row))
      );
    }
    if (changed.length > 0) {
      const saved = new Map(changed.map((row) => [row.id, row]));
      inventoryState.setRows((current) => current.map((row) => saved.get(row.id) ?? row));
      if (!inventoryState.isLoaded) inventoryState.reload();
    }
    return { ok: true, changed, order: savedOrder, delivery: savedDelivery };
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
    const { items, scrapped, deltas } = handleRefundStock(inventory, order, lines);

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
    // The money, the goods and the order's state settle together or not at all.
    // They used to be a stock loop followed by a separate order write, so a
    // refused order write left the goods already back on the shelf with no
    // record that any money had been given back for them.
    const result = await applyOrderChange("refund", {
      orderId: order.id,
      deltas,
      order: {
        items,
        status: full ? ORDER_STATUS.CANCELLED : order.status,
        refundedAmount: orderRefunded(order) + amount,
        refundHistory: [...(order.refundHistory || []), entry],
        backorderStatus: backorderStatusOf(refunded),
      },
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "That refund was not recorded.");
      return false;
    }

    markLanded("order", order.id);
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
    markLanded("order", order.id);
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

    // ARRIVING IS THE ORDER'S BUSINESS TOO, when nothing on it is still owed.
    // Every other stage change is the delivery's alone, but this one used to
    // leave a fully delivered order sitting at Pending for ever: the tracker
    // read the delivery and said "Delivered" while the order still counted in
    // the waiting total and in the customer's open-order badge, and somebody
    // had to remember to press "Mark as done" afterwards on an order that had
    // demonstrably already gone out.
    //
    // Whether anything is still owed is decided HERE, where the counters are,
    // and travels with the write; order_command is not asked to work it out
    // again in SQL. The two rows then move together or not at all.
    const carried = nextStatus === DELIVERY_STAGE.ARRIVED ? orderForDelivery(delivery) : undefined;
    const settles =
      carried?.status === ORDER_STATUS.PENDING &&
      stockLines(carried).every((line) => outstandingOf(line) === 0);

    if (carried && settles) {
      const arrival = await applyOrderChange("arrive", {
        orderId: carried.id,
        deliveryId: delivery.id,
        order: { status: ORDER_STATUS.COMPLETED },
        delivery: { status: nextStatus },
      });
      setBusy(false);
      if (!arrival.ok) {
        toast.error(arrival.message || "That delivery was not moved.");
        return;
      }
      markLanded("delivery", delivery.id);
      toast.success(`Delivery #${delivery.id} arrived, and order #${carried.id} is done.`, {
        description: "Everything on the order has now gone out.",
      });
      logActivity({
        kind: ACTIVITY_KIND.DELIVERY,
        what: `marked delivery #${delivery.id} as ${deliveryStage(nextStatus).label.toLowerCase()}`,
        subject: `delivery:${delivery.id}`,
      });
      logActivity({
        kind: ACTIVITY_KIND.ORDER,
        what: `marked order #${carried.id} as done when its delivery arrived`,
        subject: `order:${carried.id}`,
      });
      return;
    }

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
    // The board is four columns of cards and the card has just moved between
    // two of them. Naming the delivery in a toast does not say WHERE it went;
    // the mark on the card in its new column does.
    markLanded("delivery", delivery.id);
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
   * The stock, order and manifest share one transaction. A follow-up delivery
   * is raised afterwards; a failure there is reported separately.
   *
   * THE FOLLOW-UP KEEPS THE SAME "Order #N - " PREFIX. That string is how an
   * order finds its deliveries — there is no foreign key — so the suffix goes
   * on the end where no matcher will trip over it. The run-to-run link is a
   * real column, because nothing forced that one to be a parsed string too.
   */
  async function recordDelivered(delivery, order, { toStage, delivered, manifest, followUp }) {
    setBusy(true);
    const { items, stockCommittedAt, deltas } = commitPartialDelivery(
      inventory,
      order,
      delivered
    );

    // The shelf, the order and the delivery move together. They used to be
    // three writes in a row, and the middle one failing left a message telling
    // the person to go and count the shelf themselves because the goods had
    // already been deducted against a delivery that was never recorded.
    const sent = { ...order, items, stockCommittedAt };
    const result = await applyOrderChange("dispatch", {
      orderId: order.id,
      deliveryId: delivery.id,
      deltas,
      order: { items, stockCommittedAt, backorderStatus: backorderStatusOf(sent) },
      delivery: { status: toStage, itemsManifest: manifest },
    });
    if (!result.ok) {
      setBusy(false);
      toast.error(result.message || "That delivery was not recorded.");
      return false;
    }
    const { changed } = result;

    const short = manifest.filter((line) => line.backorderQty > 0);
    let raised = true;

    if (short.length > 0) {
      const followUpResult = await deliveriesState.create({
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
    markLanded("delivery", delivery.id);
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
    markLanded("delivery", delivery.id);
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
    productRetryRef.current = null;
    orderRetryRef.current = null;
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
    const url = new URL(routePath(target, null), window.location.origin);
    if (filter) url.searchParams.set('tab', filter);
    window.history.pushState(null, '', url);
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
    const state = { Product: productsState, Order: ordersState, Customer: customersState,
      Supplier: suppliersState, Delivery: deliveriesState, RawMaterial: rawMaterialsState }[RECORD_KEYS[view]];
    if (state && !state.isLoaded) return state.error
      ? <div role="alert">Could not load this record. <button onClick={state.reload}>Try again</button></div>
      : <RouteFallback />;
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
            // Clearing the selection is what makes this an ADD. The product
            // form decides between adding and editing purely from
            // selectedProductId (see saveProduct), and the dashboard is
            // reachable from a product's own screen -- so without this, "Add a
            // product" opened the last product viewed and saving it overwrote
            // that product instead of creating a new one. The products list
            // (onAdd below) and the header's primary action already clear it;
            // this was the one entry point that did not.
            onAddProduct={() => { setSelectedProductId(null); navigate("product-form"); }}
            onAddCustomer={() => openProfileForm("customer")}
            onWriteOrder={() => navigate("order-form")}
            onRecordMade={(productId, needed) => setRecordMadeFor({ productId: typeof productId === 'number' ? productId : undefined, needed })}
            onContext={handleContext}
          />
        );

      case 'raw-materials':
      case 'raw-material-detail':
      case 'raw-material-orders':
      case 'production':
      case 'production-report':
        return <WorkshopPage key={view} section={view} profile={profile} data={workshopData}
          materialId={selectedRawMaterialId} onViewMaterial={(id) => { setSelectedRawMaterialId(id); navigate('raw-material-detail'); }}
          isLoaded={[...workshopStates, productsState, inventoryState, ordersState, suppliersState].every((s) => s.isLoaded) && isStaffLoaded}
          error={[...workshopStates, productsState, inventoryState, ordersState, suppliersState].find((s) => s.error)?.error || staffError}
          onRetry={() => { reloadWorkshop(); productsState.reload(); inventoryState.reload(); ordersState.reload(); suppliersState.reload(); resolveStaff({ force: true }); }}
          onCommand={handleWorkshopCommand} onContext={handleContext} onNavigate={navigate}
          change={recordChange} />;

      // ---- products ----
      case "products":
        return (
          <ProductListPage
            change={recordChange}
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
            canDelete={isAdminRole(profile?.role)}
            onDelete={deleteProduct}
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
            change={recordChange}
            isLoaded={ordersState.isLoaded}
            loadError={ordersState.error}
            onRetry={ordersState.reload}
            orders={orders}
            onReorder={async (ids) => {
              const { error } = await supabase.rpc('reorder_orders', { p_ids: ids });
              if (error) return { ok: false, message: error.message };
              const positions = new Map(ids.map((id, index) => [id, index + 1]));
              ordersState.setRows((prev) => prev.map((row) => ({ ...row, priorityPosition: positions.get(row.id) ?? row.priorityPosition })));
              ordersState.reload();
              return { ok: true };
            }}
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
            // The linked customer where the order carries one, and the name
            // match only for an order that does not -- a walk-in, or one taken
            // before the link existed. A plain chain is right here, unlike the
            // merge in utils/customers, because this resolves ONE order to one
            // person rather than gathering a history.
            customer={
              customers.find((c) => c.id === selectedOrder?.customerId) ??
              (selectedOrder?.customerId == null
                ? customers.find(
                    (c) =>
                      String(c.name || "").trim().toLowerCase() ===
                      String(selectedOrder?.customerName || "").trim().toLowerCase()
                  )
                : undefined)
            }
            deliveries={deliveries}
            busy={busy}
            canHandleMoney={canHandleMoney(profile?.role)}
            onBack={() => navigate("orders")}
            onMarkDone={() => markOrderDone(selectedOrder)}
            onPrint={() => window.print()}
            onRefund={() => setRefundFor(selectedOrder.id)}
            onAdjustPrice={() => setAdjustPriceFor(selectedOrder.id)}
            onReopen={reopenOrder}
            canEdit={canHandleMoney(profile?.role) && orderIsEditable(selectedOrder)}
            editBlocker={orderEditBlocker(selectedOrder)}
            onEdit={() => navigate("order-edit")}
            onCancelOrder={() => cancelOrder(selectedOrder)}
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

      case "order-edit":
        return (
          <OrderFormPage
            key={`edit-${selectedOrderId ?? "none"}`}
            mode="edit"
            order={selectedOrder}
            delivery={deliveryForOrder(selectedOrder, deliveries)}
            customers={customers}
            products={products}
            inventory={inventory}
            // Its own reservations are excluded, or the order would be shown as
            // competing with itself for the stock it has already asked for.
            existingOrders={orders.filter((o) => o.id !== selectedOrderId)}
            saving={busy}
            onSave={updateOrder}
            onCancel={() => navigate("order-detail")}
          />
        );

      // ---- deliveries ----
      case "deliveries":
        return (
          <DeliveryBoardPage
            change={recordChange}
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
            change={recordChange}
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
            change={recordChange}
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
            purchaseOrders={rawMaterialOrdersState.rows.filter((order) => order.supplier_id === selectedSupplierId)}
            onOpenPurchases={() => navigate('raw-material-orders')}
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
            change={recordChange}
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
        return <NotFoundState noun="page" onBack={() => navigate('dashboard')} />;
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
        // The list is handed over so the dialog can ask "there is already a
        // customer with this name — is this a different one?". A question, not
        // a rule: two real customers can genuinely share a name, so there is no
        // unique constraint behind this and there should not be one.
        customers={customers}
        onSave={makeRecordSaveHandler("customer")}
      />
      <SupplierFormDialog
        key={`supplier-${profileDialog?.id ?? "new"}`}
        open={profileDialog?.kind === "supplier"}
        onOpenChange={(next) => !next && setProfileDialog(null)}
        mode={profileDialog?.id == null ? "add" : "edit"}
        supplier={suppliers.find((s) => s.id === profileDialog?.id)}
        suppliers={suppliers}
        onSave={makeRecordSaveHandler("supplier")}
      />
      <CreateAccountDialog
        open={isCreateStaffOpen}
        onOpenChange={setIsCreateStaffOpen}
        onAccountCreated={handleAccountCreated}
        // For the duplicate email/username check before submit. The unique
        // indexes in schema.sql are still the boundary; this is only faster.
        staff={staff}
      />
      {recordMadeFor !== null && <StartBatchDialog {...workshopData}
        productId={recordMadeFor.productId} needed={recordMadeFor.needed} profile={profile}
        onClose={() => setRecordMadeFor(null)}
        onSave={async (values, key) => {
          const result = await handleWorkshopCommand('start_batch', values, key);
          if (result.ok) navigate('production');
          return result;
        }} />}
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
            toast.info(`Ask whoever set this up for you about “${meta.title}.”`, {
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
          {denied ? <NotAllowedState role={profile?.role} onGoToDashboard={() => navigate("dashboard")} onSignOut={handleSignOut} /> : renderView()}
        </Shell>
      )}

      {isSignedIn && dialogs}

      {/* Mounted once, at the root, so a failed write on any screen has
          somewhere to report itself. */}
      <Toaster />
    </>
  );
}
