import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import { isAdminEmail } from "./utils/adminAccess";
import LoginPage from "./components/LoginPage.jsx";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import VerifyIdentityPage from "./components/VerifyIdentityPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import UpdateCredentialsPage from "./components/UpdateCredentialsPage";
import CreateUserAccountPage from "./components/CreateUserAccountPage";
import UserAccountsPage from "./components/UserAccountsPage";
import AdminDashboard from "./components/AdminDashboard.jsx";

/**
 * Simple view-state "router" — swap this for react-router-dom once that's
 * added to the project. Each screen's callback props (onNavigate, onBack,
 * etc.) just call setView here.
 */
export default function App() {
  const [view, setView] = useState("checking-session");

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
    setView("login");
  }

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
      return <AdminDashboard onSignOut={handleSignOut} />;

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
          onNavigate={setView}
          onSignOut={handleSignOut}
          onCreateAccount={() => setView("create")}
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

    default:
      return null;
  }
}
