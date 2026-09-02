import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import { canAccess, isAdminRole } from "./utils/permissions";
import { nameFromEmail } from "./utils/staffData";
import { saveOwnProfile, staffCollection } from "./utils/storageManager";
import useIdleTimeout, { clearIdleStamp } from "./hooks/useIdleTimeout";
import useSupabaseCollection from "./hooks/useSupabaseCollection";
import { nowIso } from "./utils/profileFormat";
import { staffClaimsFromSession } from "./utils/sessionClaims";
import { Toaster, toast } from "@/components/ui/sonner";
import {
  customersCollection,
  productsCollection,
  suppliersCollection,
  inventoryCollection,
} from "./utils/storageManager";

// Login is the entry point, so it stays in the initial bundle. Everything
// behind it is split out and fetched on first navigation — the dashboard
// pulls in the whole inventory/orders workspace, which no signed-out
// visitor needs to download.
import LoginPage from "./components/LoginPage.jsx";

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

const ForgotPasswordPage = lazy(() => import("./components/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage"));
const UpdateCredentialsPage = lazy(() => import("./components/UpdateCredentialsPage"));
const CreateUserAccountPage = lazy(() => import("./components/CreateUserAccountPage"));
const UserAccountsPage = lazy(() => import("./components/UserAccountsPage"));
const ManageUserAccountPage = lazy(() => import("./components/ManageUserAccountPage"));
const AssignStaffRolePage = lazy(() => import("./components/AssignStaffRolePage"));
const StaffActivityLogPage = lazy(() => import("./components/StaffActivityLogPage"));
const StaffDirectoryPage = lazy(() => import("./components/StaffDirectoryPage"));
const ViewProfilePage = lazy(() => import("./components/ViewProfilePage"));
const UpdateProfilePage = lazy(() => import("./components/UpdateProfilePage"));
const InventoryWorkspacePlaceholder = lazy(() =>
  import("./components/InventoryWorkspacePlaceholder.jsx")
);
const DashboardPage = lazy(() => import("./components/DashboardPage.jsx"));
const SalesDashboard = lazy(() => import("./components/SalesDashboard.jsx"));
const ProductionDashboard = lazy(() => import("./components/ProductionDashboard.jsx"));
const CustomerListPage = lazy(() => import("./components/profiles/CustomerListPage"));
const CustomerDetailPage = lazy(() => import("./components/profiles/CustomerDetailPage"));
const CustomerFormPage = lazy(() => import("./components/profiles/CustomerFormPage"));
const ProductListPage = lazy(() => import("./components/profiles/ProductListPage"));
const ProductDetailPage = lazy(() => import("./components/profiles/ProductDetailPage"));
const ProductFormPage = lazy(() => import("./components/profiles/ProductFormPage"));
const SupplierListPage = lazy(() => import("./components/profiles/SupplierListPage"));
const SupplierDetailPage = lazy(() => import("./components/profiles/SupplierDetailPage"));
const SupplierFormPage = lazy(() => import("./components/profiles/SupplierFormPage"));

/** Shown while a route chunk is still downloading. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f4ec] text-sm text-[#5f6875]">
      Loading…
    </div>
  );
}

/** Shown when someone reaches a screen their role doesn't allow. */
function NotAuthorized({ role, onBack, onSignOut }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#f7f4ec] px-6 text-center">
      <p className="text-base font-semibold text-[#17263a]">
        You don&rsquo;t have access to this screen.
      </p>
      <p className="max-w-md text-sm text-[#5f6875]">
        {role
          ? `The ${role} role can't open this screen. Contact your system administrator if you need access.`
          : "Your account's role couldn't be confirmed, so access is restricted. Try signing in again."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-[#1b3a6b] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#17263a]"
        >
          Back to Dashboard
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg border border-[#17263a29] px-4 py-2.5 text-sm font-medium text-[#17263a] transition hover:bg-[#17263a08]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}


// How long a signed-in session survives with no interaction. Tunable per
// deployment via .env; 30 minutes if unset.
const IDLE_TIMEOUT_MS =
  (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 30) * 60_000;

/**
 * Simple view-state "router" — swap this for react-router-dom once that's
 * added to the project. Each screen's callback props (onNavigate, onBack,
 * etc.) just call setView here.
 *
 * The staff list lives here rather than inside each screen so an edit made
 * on one page (block an account, change a role, update a profile) is
 * visible on the others. It's loaded from and persisted to Supabase's
 * `staff` table — see src/utils/storageManager.js. Unlike inventory in
 * AdminDashboard, there's no placeholder fallback seeded into it when it's
 * empty — real rows come from the SQL Editor or the sign-in bootstrap below.
 *
 * Access is gated by having a `staff` row, not just a valid Supabase
 * session: signing in successfully only gets someone past LoginPage, then
 * handleLoginAttempt below looks them up by email. Every role now lands on
 * the same DashboardPage (Figma #13); what differs is the sidebar, which
 * hides User Management and the Staff Activity Log from non-Admins (see
 * layout/ManagementShell). The inventory/deliveries/orders workspace moved
 * to the "workspace" view key and is reached from the dashboard.
 *
 * VITE_ADMIN_EMAILS + bootstrapAdminRow below used to be how the very
 * first Admin got their row created automatically on first sign-in. RLS
 * (see supabase/schema.sql) now requires an existing active `staff` row
 * to insert one at all, so that self-service path can't actually write
 * anything anymore — the first Admin's row has to be seeded by hand via
 * the SQL block at the bottom of schema.sql instead. This path is left in
 * as a harmless fallback (it fails closed: the insert is rejected by RLS,
 * not silently allowed) rather than ripped out, in case a future policy
 * change reopens it.
 */
export default function App() {
  const [view, setView] = useState("checking-session");
  const [staff, setStaff] = useState([]);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [sessionEmail, setSessionEmail] = useState(null);
  // The staff claims carried on the access token, when the Auth hook is
  // enabled. Used to route before the staff table has been read -- never as an
  // access decision; see utils/sessionClaims.js.
  const [sessionClaims, setSessionClaims] = useState(null);

  // The customer / product / supplier profile records (Figma #14-#22). Unlike
  // `staff` below — which the sign-in path has to read before it can route —
  // nothing depends on these being loaded, so they go through the shared hook
  // and only start reading once someone is actually signed in.
  const isSignedIn = !!sessionEmail;
  const customersState = useSupabaseCollection(customersCollection, { enabled: isSignedIn });
  const productsState = useSupabaseCollection(productsCollection, { enabled: isSignedIn });
  const suppliersState = useSupabaseCollection(suppliersCollection, { enabled: isSignedIn });

  const { rows: customers } = customersState;
  const { rows: products } = productsState;
  const { rows: suppliers } = suppliersState;

  // Read-only here. The inventory workspace owns this table and holds its own
  // copy; the Production dashboard only needs stock levels to tell which
  // catalog entries are running low (see ProductionDashboard's join on item
  // code). Nothing on this side writes to it.
  const { rows: inventory } = useSupabaseCollection(inventoryCollection, {
    enabled: isSignedIn,
  });

  // Which record a detail/form screen is looking at, and whether that form is
  // adding or editing. One set per collection so navigating between sections
  // doesn't drag the previous section's selection along.
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [formMode, setFormMode] = useState("add");

  // Derived so it always reflects the latest edit rather than a stale copy.
  const selectedAccount = staff.find((s) => s.id === selectedAccountId);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // The signed-in person's own staff row, matched by email. Falls back to a
  // synthesized record (from the email itself) for the brief window before
  // their row has been read.
  //
  // That fallback is deliberately NOT an Admin. It used to be, which meant any
  // moment the staff row couldn't be found — a slow read, a missing row, a
  // failed query — silently promoted whoever was signed in to full admin
  // rights. An unknown role has to be the least privileged one, not the most.
  const profile = useMemo(() => {
    const match = staff.find((s) => sameEmail(s.email, sessionEmail));
    if (match) return match;

    // No row yet. The token's claim fills the gap so the route gate has a real
    // role to work with during the read -- this is what stops an admin being
    // shown "You don't have access to this screen" for a moment on load.
    //
    // Still least-privileged when there is nothing to go on: without the hook
    // enabled the role stays null, and canAccess() denies on null.
    return {
      id: null,
      name: nameFromEmail(sessionEmail),
      role: sessionClaims?.role ?? null,
      contactNumber: "",
      status: sessionClaims?.status ?? "Active",
      email: sessionEmail,
      isSuperAdmin: sessionClaims?.isSuperAdmin ?? false,
    };
  }, [staff, sessionEmail, sessionClaims]);

  const isAdmin = isAdminRole(profile?.role);

  // See the class doc comment above: this no longer actually persists
  // anything under the current RLS policies. Kept as a harmless fallback.
  function bootstrapAdminRow(email) {
    return {
      id: Date.now(),
      name: nameFromEmail(email),
      role: "Admin",
      contactNumber: "",
      status: "Active",
      email,
    };
  }

  // The in-flight staff read. Deliberately NOT started until there's a
  // session: `staff` is gated by is_active_staff(), so an anonymous read
  // succeeds and returns zero rows. That empty result is indistinguishable
  // from a genuinely empty table, and caching it here used to poison
  // everything downstream — sign-in found no matching row and reported "this
  // account doesn't have dashboard access", and the persist effect, armed by
  // the same read, then wrote that emptiness back over the real rows.
  const staffPromiseRef = useRef(null);
  // The exact array that read handed back, so the persist effect below can
  // tell "freshly loaded" from "actually edited" by identity.
  const loadedStaffRef = useRef(null);

  // Resolves to the staff rows, priming component state the first time it's
  // called. Returns null if the read failed — callers fall back to whatever
  // is already in state rather than treating a failure as an empty table.
  //
  // `force` re-reads even if a previous call already resolved. Signing in
  // changes what RLS will return, so anything cached from before the session
  // existed has to be thrown away rather than reused.
  async function resolveStaff({ force = false } = {}) {
    if (isStaffLoaded && !force) return staff;
    if (force) staffPromiseRef.current = null;
    staffPromiseRef.current ??= staffCollection.load([]);
    const result = await staffPromiseRef.current;

    // A failed read hands back the empty fallback, which is indistinguishable
    // from a genuinely empty table. Leaving isStaffLoaded false keeps the
    // persist effect below disarmed so it can't sync that emptiness back and
    // delete every staff row.
    if (!result.ok) return null;

    loadedStaffRef.current = result.data;
    setStaff(result.data);
    setIsStaffLoaded(true);
    return result.data;
  }

  // On load: check for an existing Supabase session, so someone doesn't have
  // to log in again on every refresh. The staff read only starts once that
  // session is confirmed — see the note on staffPromiseRef for why reading it
  // while signed out is worse than not reading it at all. A signed-out visitor
  // gets the login form as soon as getSession() comes back (a localStorage
  // read, unless the stored token needs refreshing).
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
      // session and we can route on this frame -- no table read, no blank
      // "checking-session" gap, no chance of flashing "You don't have access"
      // at an admin whose row simply hadn't arrived yet.
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

        // Deliberately NOT awaited. The screen is already up; this fills in
        // the staff list the admin screens need, and the verification effect
        // below signs the person out if the real row disagrees with the claim.
        resolveStaff();
        return;
      }

      // SLOW PATH, unchanged: no hook enabled, or an account with no staff row.
      const staffRows = await resolveStaff();
      if (cancelled) return;
      if (staffRows === null) {
        setView("login");
        return;
      }

      const match = staffRows.find((s) => sameEmail(s.email, email));
      if (match?.status === "Blocked") {
        // A blocked account shouldn't stay signed in just because it has
        // an old session lying around.
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
        // A leftover session for an account nobody provisioned in
        // `staff` (or removed from) — don't leave them signed in to
        // nothing.
        clearIdleStamp();
        supabase.auth.signOut();
        setView("login");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The table is the authority, the claim was only a head start.
  //
  // Routing from a JWT claim means acting on information that is up to an hour
  // stale, so once the real staff row lands it gets the final say: an account
  // that has since been blocked, or removed entirely, is signed out here. RLS
  // already denies it every row and every write in the meantime, so the window
  // buys empty chrome, never data.
  useEffect(() => {
    if (!sessionEmail || !isStaffLoaded) return;
    const match = staff.find((s) => sameEmail(s.email, sessionEmail));
    if (!match || match.status === "Blocked") {
      handleSignOut();
    }
  }, [sessionEmail, isStaffLoaded, staff]);

  // Clicking the link from ForgotPasswordPage's email brings someone back
  // here already signed into a temporary recovery session — Supabase fires
  // this event when that happens. Jump straight to the reset-password
  // screen regardless of whatever the mount-time check above decided,
  // since a recovery session isn't a normal login.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("reset-password");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Sign out after a stretch of inactivity. Armed only while signed in.
  useIdleTimeout({
    enabled: !!sessionEmail,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: handleSignOut,
  });

  // There is deliberately NO persist-on-change effect here any more.
  //
  // There used to be one: whenever the `staff` array changed identity it wrote
  // the WHOLE table back, upserting every row and deleting any that had
  // vanished from memory. That is what destroyed data during class testing — a
  // read denied by RLS came back empty, the app appended a row to that
  // emptiness, and the sync deleted everyone else. It also meant a rejected
  // write was invisible, because nothing awaited the result.
  //
  // Staff mutations now go through the three helpers below. Each touches one
  // row, awaits the database, reports failure to the user, and only then
  // updates local state — so what is on screen is what is actually stored.

  /** Writes one staff row, syncing local state only once the database agrees. */
  async function persistStaff(operation, optimisticApply) {
    const result = await operation();
    if (!result.ok) {
      toast.error(result.message || "Couldn't save that change.");
      return result;
    }
    optimisticApply?.(result);
    return result;
  }

  // Called by LoginPage right after a successful signInWithPassword.
  // Returns "ok" | "blocked" | "no-access" and routes by role when it's
  // "ok". Awaits the staff read started at mount — normally long since
  // settled by the time someone finishes typing credentials, but this no
  // longer assumes it, since the login screen now paints without waiting.
  async function handleLoginAttempt(email) {
    // A fresh sign-in always starts a fresh idle window, whatever a previous
    // session left behind.
    clearIdleStamp();

    // FAST PATH. The token minted a moment ago already carries the role, so the
    // dashboard can open without waiting on a table read. getSession() here is
    // a localStorage read, not a network call.
    const { data: sessionData } = await supabase.auth.getSession();
    const claims = staffClaimsFromSession(sessionData.session);
    if (claims?.role) {
      if (claims.status === "Blocked") return "blocked";
      setSessionClaims(claims);
      setSessionEmail(email);
      setView("dashboard");
      // Background: populates the staff list and lets the verification effect
      // re-check the live row against the claim.
      resolveStaff({ force: true });
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
      return "ok";
    }
    if (isAdminEmail(email)) {
      // See bootstrapAdminRow above — this optimistically shows the
      // dashboard, but the row it tries to create won't actually save
      // under the current RLS unless it already existed (seeded via
      // schema.sql). Left in as a harmless fallback, not the real path in.
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
    setSessionEmail(null);
    setView("login");
  }

  /**
   * My Profile's save. Writes the one row directly rather than letting the
   * whole-table persist effect below pick the change up — that effect
   * reconciles every staff row, which a non-admin has no permission to do.
   */
  async function updateProfile(changes) {
    const next = { ...profile, ...changes };
    const result = await saveOwnProfile(next);
    if (!result.ok) {
      toast.error(result.message || "Couldn't save your profile.");
      return false;
    }
    setStaff((prev) =>
      prev.map((s) => (sameEmail(s.email, sessionEmail) ? { ...s, ...changes } : s))
    );
    return true;
  }

  async function handleRowAction(action, user) {
    if (action === "edit" || action === "block" || action === "unblock") {
      setSelectedAccountId(user.id);
      setView("manage-account");
      return;
    }
    if (action !== "delete") return;

    // The UI hides Delete for your own row and for the superadmin, and the
    // database refuses both outright. These are the belt to that braces: a
    // stale render shouldn't be able to fire a request the server will reject.
    if (sameEmail(user.email, sessionEmail)) {
      toast.error("You can't delete your own account.");
      return;
    }
    if (user.isSuperAdmin) {
      toast.error("The super administrator account can't be deleted.");
      return;
    }

    // Awaited, and its result checked. Previously the row was filtered out of
    // local state immediately and the write was fire-and-forget, so a delete
    // the database rejected still vanished from the screen — and came back on
    // the next refresh.
    await persistStaff(
      () => staffCollection.remove(user.id),
      () => {
        setStaff((prev) => prev.filter((s) => s.id !== user.id));
        if (selectedAccountId === user.id) setSelectedAccountId(null);
        toast.success(`${user.name} was removed.`);
      }
    );
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
    return result.ok;
  }

  // ---- customer / product / supplier profiles ----------------------------

  /**
   * Builds the save handler a profile form calls on submit. Adding stamps a
   * fresh id and both dates; editing merges into the selected record and
   * touches `updatedAt` only. Returns the saved record's id so the form's
   * success panel knows which record "View X" should open.
   *
   * Ids are Date.now() to match handleAccountCreated above — the tables use a
   * plain bigint primary key with no sequence, so the client picks them.
   */
  function makeSaveHandler(state, records, selectedId, setSelectedId) {
    return async (values) => {
      const now = nowIso();

      if (formMode === "edit" && selectedId !== null) {
        const current = records.find((r) => r.id === selectedId);
        const result = await state.update(selectedId, {
          ...current,
          ...values,
          updatedAt: now,
        });
        if (!result.ok) {
          toast.error(result.message || "Couldn't save your changes.");
          return null;
        }
        return selectedId;
      }

      const id = Date.now();
      const result = await state.create({
        ...values,
        id,
        createdAt: now,
        updatedAt: now,
      });
      if (!result.ok) {
        toast.error(result.message || "Couldn't save that record.");
        return null;
      }
      setSelectedId(id);
      return id;
    };
  }

  /** Opens a profile form. `id` is null when adding. */
  function openProfileForm(view, setSelectedId, id = null) {
    setSelectedId(id);
    setFormMode(id === null ? "add" : "edit");
    setView(view);
  }

  /** Opens a profile detail screen. */
  function openProfileDetail(view, setSelectedId, id) {
    setSelectedId(id);
    setView(view);
  }

  // Guard for deep-linked/stale account views: show the list instead of
  // rendering a screen with no record behind it.
  function renderMissingAccount() {
    return (
      <UserAccountsPage
        isAdmin={isAdmin}
        users={staff}
        isLoaded={isStaffLoaded}
        currentUserEmail={sessionEmail}
        onNavigate={setView}
        onSignOut={handleSignOut}
        onCreateAccount={() => setView("create")}
        onRowAction={handleRowAction}
      />
    );
  }

  function renderView() {
    // Authorization, not decoration. Hiding a nav link only hides the link —
    // the view still renders for anyone who reaches it another way, and every
    // one of these screens was reachable by a non-admin through the shared
    // AppShell header. This is the check that actually stops them.
    //
    // Resolved through utils/permissions, which covers both halves of the
    // sidebar's filter: the admin-only screens, and the per-role denials that
    // ManagementShell's `hideFrom` was enforcing on the nav entry alone (a
    // Production Staff account could still land on the customer and supplier
    // screens the design omits from their sidebar).
    //
    // Guarded on sessionEmail so it only applies once someone is signed in —
    // the pre-auth views (login, password reset, checking-session) have no role
    // to check against and must stay reachable.
    if (sessionEmail && !canAccess(profile?.role, view)) {
      return (
        <NotAuthorized
          role={profile?.role}
          onBack={() => setView("dashboard")}
          onSignOut={handleSignOut}
        />
      );
    }

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

      // Each role lands on the dashboard designed for it. Sales Staff and
      // Production Staff have their own (Figma #23 / #24); Admin keeps #13, and
      // roles with no design of their own (Manager, Delivery Staff) stay on it
      // too rather than being shown a screen built for someone else's job.
      case "dashboard":
        if (profile?.role === "Sales Staff") {
          return (
            <SalesDashboard
              customers={customers}
              products={products}
              suppliers={suppliers}
              profile={profile}
              onNavigate={setView}
              onSignOut={handleSignOut}
              onAddCustomer={() =>
                openProfileForm("customer-form", setSelectedCustomerId)
              }
            />
          );
        }

        if (profile?.role === "Production Staff") {
          return (
            <ProductionDashboard
              products={products}
              inventory={inventory}
              profile={profile}
              onNavigate={setView}
              onSignOut={handleSignOut}
              onAddProduct={() =>
                openProfileForm("product-form", setSelectedProductId)
              }
            />
          );
        }

        return (
          <DashboardPage
            staff={staff}
            isLoaded={isStaffLoaded}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      // The inventory/deliveries/orders workspace is being rebuilt. The old
      // screen (components/AdminDashboard.jsx + layout/Sidebar + views/) is
      // still on disk but no longer routed — it was the last thing using the
      // pre-Figma chrome, and it showed the same admin-looking shell to every
      // role. See components/InventoryWorkspacePlaceholder.jsx.
      case "workspace":
        return (
          <InventoryWorkspacePlaceholder
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      case "forgot-password":
        return <ForgotPasswordPage onBack={() => setView("login")} />;

      case "reset-password":
        return (
          <ResetPasswordPage
            onReturnToLogin={() => {
              // They're sitting on a temporary recovery session — sign out
              // so "Return to Login" means a deliberate fresh sign-in with
              // the new password, not a silent slide into the dashboard.
              handleSignOut();
            }}
          />
        );

      case "accounts":
        return (
          <UserAccountsPage
            isAdmin={isAdmin}
            users={staff}
            isLoaded={isStaffLoaded}
            currentUserEmail={sessionEmail}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCreateAccount={() => setView("create")}
            onRowAction={handleRowAction}
          />
        );

      case "manage-account":
        // Falls back to the accounts list if the row went away (e.g. deleted).
        if (!selectedAccount) return renderMissingAccount();
        return (
          <ManageUserAccountPage
            isAdmin={isAdmin}
            key={selectedAccount.id}
            account={selectedAccount}
            currentUserEmail={sessionEmail}
            onBack={() => setView("accounts")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onStatusChange={async (status) => {
              if (await updateSelectedAccount({ status })) {
                toast.success(
                  status === "Blocked" ? "Account blocked." : "Account unblocked."
                );
              }
            }}
            onSaveDetails={async (changes) => {
              if (await updateSelectedAccount(changes)) {
                toast.success("Account updated.");
              }
            }}
            onChangeRole={() => setView("assign-role")}
          />
        );

      case "assign-role":
        if (!selectedAccount) return renderMissingAccount();
        return (
          <AssignStaffRolePage
            isAdmin={isAdmin}
            account={selectedAccount}
            onBack={() => setView("manage-account")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onSaved={async (role) => {
              // Only leave the screen if the role change actually persisted.
              // Navigating first is how a rejected write used to look like a
              // successful one.
              if (await updateSelectedAccount({ role })) {
                toast.success("Role updated.");
                setView("manage-account");
              }
            }}
          />
        );

      case "create":
        return (
          <CreateUserAccountPage
            isAdmin={isAdmin}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("accounts")}
            onAccountCreated={handleAccountCreated}
          />
        );

      case "credentials":
        return (
          <UpdateCredentialsPage
            isAdmin={isAdmin}
            currentUserEmail={sessionEmail}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("accounts")}
          />
        );

      case "activity":
        return (
          <StaffActivityLogPage
            isAdmin={isAdmin}
            staff={staff}
            isLoaded={isStaffLoaded}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      case "directory":
        return (
          <StaffDirectoryPage
            isAdmin={isAdmin}
            staff={staff}
            isLoaded={isStaffLoaded}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      case "profile":
        return (
          <ViewProfilePage
            isAdmin={isAdmin}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onUpdateProfile={() => setView("update-profile")}
            onGoToCredentials={() => setView("credentials")}
          />
        );

      case "update-profile":
        return (
          <UpdateProfilePage
            isAdmin={isAdmin}
            profile={profile}
            onBack={() => setView("profile")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onSaved={async (changes) => {
              if (await updateProfile(changes)) {
                toast.success("Profile updated.");
                setView("profile");
              }
            }}
          />
        );

      case "customers":
        return (
          <CustomerListPage
            isLoaded={customersState.isLoaded}
            loadError={customersState.error}
            onRetry={customersState.reload}
            customers={customers}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onView={(id) =>
              openProfileDetail("customer-detail", setSelectedCustomerId, id)
            }
            onEdit={(id) =>
              openProfileForm("customer-form", setSelectedCustomerId, id)
            }
            onAdd={() => openProfileForm("customer-form", setSelectedCustomerId)}
          />
        );

      case "customer-detail":
        return (
          <CustomerDetailPage
            customer={selectedCustomer}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onBack={() => setView("customers")}
            onEdit={(id) =>
              openProfileForm("customer-form", setSelectedCustomerId, id)
            }
          />
        );

      case "customer-form":
        return (
          <CustomerFormPage
            key={selectedCustomerId ?? "new"}
            mode={formMode}
            customer={selectedCustomer}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("customers")}
            onSave={makeSaveHandler(
              customersState,
              customers,
              selectedCustomerId,
              setSelectedCustomerId
            )}
            onView={(id) =>
              openProfileDetail("customer-detail", setSelectedCustomerId, id)
            }
          />
        );

      case "products":
        return (
          <ProductListPage
            isLoaded={productsState.isLoaded}
            loadError={productsState.error}
            onRetry={productsState.reload}
            inventory={inventory}
            products={products}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onView={(id) =>
              openProfileDetail("product-detail", setSelectedProductId, id)
            }
            onEdit={(id) =>
              openProfileForm("product-form", setSelectedProductId, id)
            }
            onAdd={() => openProfileForm("product-form", setSelectedProductId)}
          />
        );

      case "product-detail":
        return (
          <ProductDetailPage
            inventory={inventory}
            product={selectedProduct}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onBack={() => setView("products")}
            onEdit={(id) =>
              openProfileForm("product-form", setSelectedProductId, id)
            }
          />
        );

      case "product-form":
        return (
          <ProductFormPage
            key={selectedProductId ?? "new"}
            mode={formMode}
            product={selectedProduct}
            products={products}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("products")}
            onSave={makeSaveHandler(
              productsState,
              products,
              selectedProductId,
              setSelectedProductId
            )}
            onView={(id) =>
              openProfileDetail("product-detail", setSelectedProductId, id)
            }
          />
        );

      case "suppliers":
        return (
          <SupplierListPage
            isLoaded={suppliersState.isLoaded}
            loadError={suppliersState.error}
            onRetry={suppliersState.reload}
            suppliers={suppliers}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onView={(id) =>
              openProfileDetail("supplier-detail", setSelectedSupplierId, id)
            }
            onEdit={(id) =>
              openProfileForm("supplier-form", setSelectedSupplierId, id)
            }
            onAdd={() => openProfileForm("supplier-form", setSelectedSupplierId)}
          />
        );

      case "supplier-detail":
        return (
          <SupplierDetailPage
            supplier={selectedSupplier}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onBack={() => setView("suppliers")}
            onEdit={(id) =>
              openProfileForm("supplier-form", setSelectedSupplierId, id)
            }
          />
        );

      case "supplier-form":
        return (
          <SupplierFormPage
            key={selectedSupplierId ?? "new"}
            mode={formMode}
            supplier={selectedSupplier}
            profile={profile}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("suppliers")}
            onSave={makeSaveHandler(
              suppliersState,
              suppliers,
              selectedSupplierId,
              setSelectedSupplierId
            )}
            onView={(id) =>
              openProfileDetail("supplier-detail", setSelectedSupplierId, id)
            }
          />
        );

      default:
        return null;
    }
  }

  return (
    <>
      <Suspense fallback={<RouteFallback />}>{renderView()}</Suspense>
      {/* Mounted once, at the root, so a failed write on any screen has
          somewhere to report itself. Before this, every rejected save was a
          console.error nobody saw. */}
      <Toaster />
    </>
  );
}
