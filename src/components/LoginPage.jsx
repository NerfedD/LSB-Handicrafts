import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "./icons";
import AuthLayout from "./layout/AuthLayout";
import { supabase } from "../lib/supabaseClient";

/**
 * LSB Handicrafts — Login
 * Figma: State 1 (default), State 2 (invalid credentials), State 3 (account locked)
 */
export default function LoginPage({ onLoginAttempt, onForgotPassword }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | error | locked | restricted | blocked
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Supabase Auth only authenticates on email, so a username has to be traded
   * for one first. `email_for_username` is a SECURITY DEFINER function — see
   * supabase/schema.sql — because at this point nobody is signed in yet and the
   * staff policies deny every ordinary read.
   *
   * Anything containing "@" is taken as an email and passed straight through,
   * so this costs a round trip only for people who actually type a username.
   */
  async function resolveEmail(value) {
    if (value.includes("@")) return value;

    const { data, error } = await supabase.rpc("email_for_username", {
      p_username: value,
    });
    // A username nobody holds is a failed sign-in, not a distinct error — it
    // would otherwise tell a stranger which usernames exist.
    if (error || !data) return null;
    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const email = await resolveEmail(identifier.trim());
      if (!email) {
        setStatus("error");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus("error");
        return;
      }

      // App.jsx decides whether this email actually gets in — it looks for
      // a matching row in the `staff` table (or the temporary admin
      // allowlist for first-ever sign-in), checks it isn't Blocked, and
      // routes by role. Anyone it doesn't grant access to is signed back
      // out immediately: "ok" | "blocked" | "no-access".
      const result = await onLoginAttempt?.(data.user.email);
      if (result !== "ok") {
        await supabase.auth.signOut();
        setStatus(result === "blocked" ? "blocked" : "restricted");
        return;
      }

      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLocked = status === "locked";
  const isRestricted = status === "restricted";
  const isBlocked = status === "blocked";

  return (
    <AuthLayout>
      <div className="mt-10">
        <h1 className="text-4xl font-bold tracking-tight text-[#17263a]">
          Hello!
        </h1>
        <p className="mt-3 text-base text-[#5f6875]">
          Please sign in to access your account.
        </p>
      </div>

      {status === "error" && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474708] px-4 py-3">
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#b54747]" />
          <p className="text-[15px] leading-6 text-[#b54747]">
            Incorrect username or password. Please check your details and try
            again.
          </p>
        </div>
      )}

      {isLocked && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474706] px-4 py-3">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-[#b54747]" />
          <div>
            <p className="text-[15px] font-semibold text-[#17263a]">
              Your account has been temporarily locked.
            </p>
            <p className="mt-2 text-sm leading-[23px] text-[#5f6875]">
              Multiple failed attempts were detected. Please contact your
              system administrator to restore access.
            </p>
          </div>
        </div>
      )}

      {isRestricted && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474706] px-4 py-3">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-[#b54747]" />
          <div>
            <p className="text-[15px] font-semibold text-[#17263a]">
              This account doesn't have dashboard access.
            </p>
            <p className="mt-2 text-sm leading-[23px] text-[#5f6875]">
              Your credentials were correct, but this account isn't set up
              in the system yet. Contact your system administrator.
            </p>
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474706] px-4 py-3">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-[#b54747]" />
          <div>
            <p className="text-[15px] font-semibold text-[#17263a]">
              This account has been blocked.
            </p>
            <p className="mt-2 text-sm leading-[23px] text-[#5f6875]">
              Your credentials were correct, but an administrator has
              blocked this account. Contact your system administrator to
              restore access.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col">
        <div>
          <label
            htmlFor="email"
            className="block text-base font-semibold text-[#17263a]"
          >
            Username or Email
          </label>
          <input
            id="email"
            type="text"
            autoComplete="username"
            disabled={isLocked}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="jdelacruz or you@example.com"
            className={`mt-2 h-13 w-full rounded-[10px] border px-4 text-[17px] text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30 disabled:opacity-60 ${
              status === "error"
                ? "border-[#b5474780] bg-white"
                : isLocked
                ? "border-[#17263a29] bg-[#ede9e0]"
                : "border-[#17263a1a] bg-white"
            }`}
          />
        </div>

        <div className="mt-6">
          <label
            htmlFor="password"
            className="block text-base font-semibold text-[#17263a]"
          >
            Password
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={isLocked}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`h-13 w-full rounded-[10px] border bg-white pl-4 pr-14 text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30 disabled:opacity-60 ${
                status === "error" || isLocked
                  ? "border-[#b5474780]"
                  : "border-[#17263a1a]"
              }`}
            />
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-[#17263a99] hover:bg-[#17263a0d] disabled:opacity-40"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="py-2 text-sm font-medium text-[#1b3a6b] underline underline-offset-2 hover:text-[#17263a]"
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLocked}
          className={`mt-8 h-13 w-full rounded-[10px] text-[17px] font-semibold tracking-[0.5px] text-white transition disabled:cursor-not-allowed ${
            isLocked
              ? "bg-[#8a9db8]"
              : "bg-[#1b3a6b] shadow-[0_2px_6px_rgba(27,58,107,0.28)] hover:bg-[#17263a] disabled:opacity-60"
          }`}
        >
          {isLocked
            ? "Account Locked"
            : isSubmitting
            ? "Signing in…"
            : "Log In"}
        </button>
      </form>
    </AuthLayout>
  );
}