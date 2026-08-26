import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import { nameFromEmail } from "./utils/staffData";
import { loadStaff, saveStaff } from "./utils/storageManager";
import useIdleTimeout, { clearIdleStamp } from "./hooks/useIdleTimeout";

// Login is the entry point, so it stays in the initial bundle. Everything
// behind it is split out and fetched on first navigation — the dashboard
// pulls in the whole inventory/orders workspace, which no signed-out
// visitor needs to download.
import LoginPage from "./components/LoginPage.jsx";

const ForgotPasswordPage = lazy(() => import("./components/ForgotPasswordPage"));
const VerifyIdentityPage = lazy(() => import("./components/VerifyIdentityPage"));
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
const AdminDashboard = lazy(() => import("./components/AdminDashboard.jsx"));
const RoleDashboardPage = lazy(() => import("./components/RoleDashboardPage.jsx"));

/** Shown while a route chunk is still downloading. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f4ec] text-sm text-[#5f6875]">
      Loading…
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
 * handleLoginAttempt below looks them up by email and routes by role —
 * Admin gets the full AdminDashboard, everyone else gets the temporary
 * RoleDashboardPage placeholder. VITE_ADMIN_EMAILS survives only as the
 * bootstrap path for the very first Admin, before any staff row exists.
 */
export default function App() {
  const [view, setView] = useState("checking-session");
  const [staff, setStaff] = useState([]);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [sessionEmail, setSessionEmail] = useState(null);

  // Derived so it always reflects the latest edit rather than a stale copy.
  const selectedAccount = staff.find((s) => s.id === selectedAccountId);

  // The signed-in admin's own staff row, matched by email. Falls back to a
  // synthesized record (from the email itself) for the brief window before
  // the bootstrap effect below has created their row in Supabase.
  const profile = useMemo(() => {
    const match = staff.find((s) => s.email && s.email === sessionEmail);
    if (match) return match;
    return {
      id: null,
      name: nameFromEmail(sessionEmail),
      role: "Admin",
      contactNumber: "",
      status: "Active",
      email: sessionEmail,
    };
  }, [staff, sessionEmail]);

  // A brand-new staff row for someone VITE_ADMIN_EMAILS bootstraps in with
  // no `staff` row yet — used the moment we discover that, in both the
  // returning-session check below and a fresh login (handleLoginAttempt).
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

  // The in-flight staff read, started at mount. Held here rather than
  // awaited alongside getSession(), because the login form doesn't need it —
  // blocking first paint on that Supabase round trip meant a blank white
  // page for as long as the query took.
  const staffPromiseRef = useRef(null);
  // The exact array that read handed back, so the persist effect below can
  // tell "freshly loaded" from "actually edited" by identity.
  const loadedStaffRef = useRef(null);

  // Resolves to the staff rows, priming component state the first time it's
  // called. Returns null if the read failed — callers fall back to whatever
  // is already in state rather than treating a failure as an empty table.
  async function resolveStaff() {
    if (isStaffLoaded) return staff;
    staffPromiseRef.current ??= loadStaff([]);
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
  // to log in again on every refresh. The staff read is kicked off in
  // parallel but only awaited when there IS a session to route — a signed-out
  // visitor gets the login form as soon as getSession() comes back (a
  // localStorage read, unless the stored token needs refreshing).
  useEffect(() => {
    let cancelled = false;
    staffPromiseRef.current ??= loadStaff([]);

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      const email = sessionData.session?.user?.email ?? null;
      if (!email) {
        clearIdleStamp();
        setView("login");
        return;
      }

      const staffRows = await resolveStaff();
      if (cancelled) return;
      if (staffRows === null) {
        setView("login");
        return;
      }

      const match = staffRows.find((s) => s.email === email);
      if (match?.status === "Blocked") {
        // A blocked account shouldn't stay signed in just because it has
        // an old session lying around.
        clearIdleStamp();
        supabase.auth.signOut();
        setView("login");
      } else if (match) {
        setSessionEmail(email);
        setView(match.role === "Admin" ? "dashboard" : "role-dashboard");
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

  // Sign out after a stretch of inactivity. Armed only while signed in.
  useIdleTimeout({
    enabled: !!sessionEmail,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: handleSignOut,
  });

  // Persist to Supabase whenever the staff list changes — skipped until the
  // initial load finishes, so it doesn't overwrite real data with the
  // placeholder defaults on first render, and skipped while `staff` is still
  // the very array the load returned. Without that second guard, every page
  // load wrote the freshly-read rows straight back — a SELECT plus a full
  // upsert — for no reason.
  useEffect(() => {
    if (!isStaffLoaded) return;
    if (staff === loadedStaffRef.current) return;
    saveStaff(staff);
  }, [staff, isStaffLoaded]);

  // Called by LoginPage right after a successful signInWithPassword.
  // Returns "ok" | "blocked" | "no-access" and routes by role when it's
  // "ok". Awaits the staff read started at mount — normally long since
  // settled by the time someone finishes typing credentials, but this no
  // longer assumes it, since the login screen now paints without waiting.
  async function handleLoginAttempt(email) {
    // A fresh sign-in always starts a fresh idle window, whatever a previous
    // session left behind.
    clearIdleStamp();

    const rows = (await resolveStaff()) ?? staff;
    const match = rows.find((s) => s.email === email);
    if (match?.status === "Blocked") return "blocked";
    if (match) {
      setSessionEmail(email);
      setView(match.role === "Admin" ? "dashboard" : "role-dashboard");
      return "ok";
    }
    if (isAdminEmail(email)) {
      // First-ever sign-in for the bootstrap admin — no staff row yet.
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
    setSessionEmail(null);
    setView("login");
  }

  function updateProfile(changes) {
    setStaff((prev) =>
      prev.map((s) => (s.email === sessionEmail ? { ...s, ...changes } : s))
    );
  }

  function handleRowAction(action, user) {
    if (action === "edit" || action === "block" || action === "unblock") {
      setSelectedAccountId(user.id);
      setView("manage-account");
      return;
    }
    if (action === "delete") {
      // UserAccountsPage already confirmed and hides this for the
      // signed-in admin's own row, but never delete your own login here.
      if (user.email && user.email === sessionEmail) return;
      setStaff((prev) => prev.filter((s) => s.id !== user.id));
      if (selectedAccountId === user.id) setSelectedAccountId(null);
    }
  }

  function updateSelectedAccount(changes) {
    setStaff((prev) =>
      prev.map((s) => (s.id === selectedAccountId ? { ...s, ...changes } : s))
    );
  }

  function handleAccountCreated({ name, role, contactNumber, email }) {
    setStaff((prev) => [
      ...prev,
      { id: Date.now(), name, role, contactNumber, status: "Active", email },
    ]);
  }

  // Guard for deep-linked/stale account views: show the list instead of
  // rendering a screen with no record behind it.
  function renderMissingAccount() {
    return (
      <UserAccountsPage
        users={staff}
        currentUserEmail={sessionEmail}
        onNavigate={setView}
        onSignOut={handleSignOut}
        onCreateAccount={() => setView("create")}
        onRowAction={handleRowAction}
      />
    );
  }

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

      case "dashboard":
        return (
          <AdminDashboard
            onSignOut={handleSignOut}
            onOpenAdmin={() => setView("accounts")}
          />
        );

      case "role-dashboard":
        return <RoleDashboardPage profile={profile} onSignOut={handleSignOut} />;

      case "forgot-password":
        return (
          <ForgotPasswordPage
            onBack={() => setView("login")}
            onContinue={() => setView("verify-identity")}
          />
        );

      case "verify-identity":
        return (
          <VerifyIdentityPage
            onBack={() => setView("forgot-password")}
            onVerified={() => setView("reset-password")}
            onRequestAdminAssistance={() => setView("login")}
          />
        );

      case "reset-password":
        return <ResetPasswordPage onReturnToLogin={() => setView("login")} />;

      case "accounts":
        return (
          <UserAccountsPage
            users={staff}
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
            key={selectedAccount.id}
            account={selectedAccount}
            currentUserEmail={sessionEmail}
            onBack={() => setView("accounts")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onStatusChange={(status) => updateSelectedAccount({ status })}
            onSaveDetails={(changes) => updateSelectedAccount(changes)}
            onChangeRole={() => setView("assign-role")}
          />
        );

      case "assign-role":
        if (!selectedAccount) return renderMissingAccount();
        return (
          <AssignStaffRolePage
            account={selectedAccount}
            onBack={() => setView("manage-account")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onSaved={(role) => {
              updateSelectedAccount({ role });
              setView("manage-account");
            }}
          />
        );

      case "create":
        return (
          <CreateUserAccountPage
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("accounts")}
            onAccountCreated={handleAccountCreated}
          />
        );

      case "credentials":
        return (
          <UpdateCredentialsPage
            onNavigate={setView}
            onSignOut={handleSignOut}
            onCancel={() => setView("accounts")}
          />
        );

      case "activity":
        return (
          <StaffActivityLogPage
            staff={staff}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      case "directory":
        return (
          <StaffDirectoryPage
            staff={staff}
            onNavigate={setView}
            onSignOut={handleSignOut}
          />
        );

      case "profile":
        return (
          <ViewProfilePage
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
            profile={profile}
            onBack={() => setView("profile")}
            onNavigate={setView}
            onSignOut={handleSignOut}
            onSaved={(changes) => {
              updateProfile(changes);
              setView("profile");
            }}
          />
        );

      default:
        return null;
    }
  }

  return <Suspense fallback={<RouteFallback />}>{renderView()}</Suspense>;
}
