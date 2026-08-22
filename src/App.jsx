import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import { SAMPLE_STAFF, DEFAULT_PROFILE } from "./utils/staffData";

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
 * The staff list and signed-in profile live here rather than inside each
 * screen so an edit made on one page (block an account, change a role,
 * update your profile) is visible on the others. They are still placeholder
 * records — see src/utils/staffData.js — and reset on reload until a real
 * `staff` table exists in Supabase.
 */
export default function App() {
  const [view, setView] = useState("checking-session");
  const [staff, setStaff] = useState(SAMPLE_STAFF);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  // Derived so it always reflects the latest edit rather than a stale copy.
  const selectedAccount = staff.find((s) => s.id === selectedAccountId);

  // On load, honor an existing Supabase session so an admin doesn't have to
  // log in again on every refresh.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const email = data.session?.user?.email;
      setView(isAdminEmail(email) ? "dashboard" : "login");
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSelectedAccountId(null);
    setView("login");
  }

  function handleRowAction(action, user) {
    if (action === "edit" || action === "block" || action === "unblock") {
      setSelectedAccountId(user.id);
      setView("manage-account");
    }
    // "delete" is handled by the table's own confirm flow.
  }

  function updateSelectedAccount(changes) {
    setStaff((prev) =>
      prev.map((s) => (s.id === selectedAccountId ? { ...s, ...changes } : s))
    );
  }

  // Guard for deep-linked/stale account views: show the list instead of
  // rendering a screen with no record behind it.
  function renderMissingAccount() {
    return (
      <UserAccountsPage
        users={staff}
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
            onLoginSuccess={() => setView("dashboard")}
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
              setProfile((prev) => ({ ...prev, ...changes }));
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
