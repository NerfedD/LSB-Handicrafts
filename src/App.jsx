import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import { nameFromEmail } from "./utils/staffData";
import { loadStaff, saveStaff } from "./utils/storageManager";

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

/** Shown while a route chunk is still downloading. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f4ec] text-sm text-[#5f6875]">
      Loading…
    </div>
  );
}


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

  // On load, honor an existing Supabase session so an admin doesn't have to
  // log in again on every refresh.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const email = data.session?.user?.email;
      if (isAdminEmail(email)) {
        setSessionEmail(email);
        setView("dashboard");
      } else {
        setView("login");
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Load the staff directory from Supabase once on mount.
  useEffect(() => {
    let cancelled = false;
    loadStaff([]).then((rows) => {
      if (cancelled) return;
      setStaff(rows);
      setIsStaffLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // First sign-in for an email with no staff row yet: create one so their
  // profile has somewhere real to live. Skipped until the initial load
  // finishes, so it never races the load and duplicates a row.
  useEffect(() => {
    if (!isStaffLoaded || !sessionEmail) return;
    const exists = staff.some((s) => s.email === sessionEmail);
    if (exists) return;
    setStaff((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: nameFromEmail(sessionEmail),
        role: "Admin",
        contactNumber: "",
        status: "Active",
        email: sessionEmail,
      },
    ]);
  }, [isStaffLoaded, sessionEmail, staff]);

  // Persist to Supabase whenever the staff list changes — skipped until the
  // initial load finishes, so it doesn't overwrite real data with the
  // placeholder defaults on first render.
  useEffect(() => {
    if (!isStaffLoaded) return;
    saveStaff(staff);
  }, [staff, isStaffLoaded]);

  async function handleSignOut() {
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
        return null;

      case "login":
        return (
          <LoginPage
            onLoginSuccess={(email) => {
              setSessionEmail(email);
              setView("dashboard");
            }}
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
            account={selectedAccount}
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
