import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import AuthLayout from "./layout/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { isAdminEmail } from "../utils/adminAccess";

/**
 * LSB Handicrafts — Login
 * Figma: State 1 (default), State 2 (invalid credentials), State 3 (account locked)
 */
export default function LoginPage({ onLoginSuccess, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | error | locked
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus("error");
        return;
      }

      // Temporary gate: only allowlisted emails may reach the dashboard.
      // Everyone else gets signed back out immediately.
      if (!isAdminEmail(data.user?.email)) {
        await supabase.auth.signOut();
        setStatus("restricted");
        return;
      }

      setStatus("idle");
      onLoginSuccess?.();
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLocked = status === "locked";
  const isRestricted = status === "restricted";

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
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474708] px-[18px] py-[14px]">
          <AlertCircle className="mt-px h-[18px] w-[18px] shrink-0 text-[#b54747]" />
          <p className="text-[15px] leading-6 text-[#b54747]">
            Incorrect username or password. Please check your details and try
            again.
          </p>
        </div>
      )}

      {isLocked && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474706] px-[18px] py-[14px]">
          <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#b54747]" />
          <div>
            <p className="text-[15px] font-semibold text-[#17263a]">
              Your account has been temporarily locked.
            </p>
            <p className="mt-1.5 text-sm leading-[23px] text-[#5f6875]">
              Multiple failed attempts were detected. Please contact your
              system administrator to restore access.
            </p>
          </div>
        </div>
      )}

      {isRestricted && (
        <div className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474706] px-[18px] py-[14px]">
          <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#b54747]" />
          <div>
            <p className="text-[15px] font-semibold text-[#17263a]">
              This account doesn't have dashboard access.
            </p>
            <p className="mt-1.5 text-sm leading-[23px] text-[#5f6875]">
              Your credentials were correct, but this email isn't on the
              admin list yet. Contact your system administrator.
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`mt-[9px] h-14 w-full rounded-[10px] border px-[18px] text-[17px] text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30 disabled:opacity-60 ${
              status === "error"
                ? "border-[#b5474780] bg-white"
                : isLocked
                ? "border-[#17263a29] bg-[#ede9e0]"
                : "border-[#17263a1a] bg-white"
            }`}
          />
        </div>

        <div className="mt-[26px]">
          <label
            htmlFor="password"
            className="block text-base font-semibold text-[#17263a]"
          >
            Password
          </label>
          <div className="relative mt-[9px]">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={isLocked}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`h-14 w-full rounded-[10px] border bg-white pl-[18px] pr-[58px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30 disabled:opacity-60 ${
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
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#17263a99] hover:bg-[#17263a0d] disabled:opacity-40"
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
            className="py-1.5 text-sm font-medium text-[#1b3a6b] underline underline-offset-2 hover:text-[#17263a]"
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLocked}
          className={`mt-[34px] h-14 w-full rounded-[10px] text-[17px] font-semibold tracking-[0.5px] text-white transition disabled:cursor-not-allowed ${
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