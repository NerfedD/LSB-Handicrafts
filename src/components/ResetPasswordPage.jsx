import { useState } from "react";
import { Eye, EyeOff, Info, CheckCircle2 } from "./icons";
import AuthLayout from "./layout/AuthLayout";

/**
 * LSB Handicrafts — Create a New Password + success confirmation
 * Figma: node 10:1525 (form), 11:1733 (success)
 */
export default function ResetPasswordPage({ onReturnToLogin }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Couldn't reset your password. Please try again.");
        return;
      }
      setSucceeded(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <AuthLayout>
        <div className="mt-11 flex flex-col items-center text-center">
          <div className="flex size-[68px] items-center justify-center rounded-full border border-[#287a5538] bg-[#287a5514]">
            <CheckCircle2 className="h-8 w-8 text-[#287a55]" />
          </div>
          <h1 className="mt-7 text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Password Reset Successful
          </h1>

          <div className="mt-6 flex w-full flex-col gap-3 rounded-[10px] border border-[#17263a14] bg-[#f7f4ec] px-[22px] py-5 text-left">
            {[
              "Your password has been successfully changed.",
              "Your previous password is no longer valid.",
              "Any other active sessions have been signed out for your security.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span className="mt-2 size-[5px] shrink-0 rounded-full bg-[#287a55]" />
                <p className="text-[15px] leading-[1.65] text-[#17263a]">
                  {line}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onReturnToLogin}
            className="mt-8 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a]"
          >
            Return to Login
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mt-11">
        <h1 className="text-[32px] font-bold leading-[1.18] tracking-tight text-[#17263a]">
          Create a New Password
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-[#5f6875]">
          Choose a new password for your account.
        </p>
      </div>

      <div className="mt-8 flex items-start gap-2.5 rounded-[9px] border border-[#1b3a6b1f] bg-[#dce8ff] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1b3a6b]" />
        <p className="text-[13.5px] leading-[1.6] text-[#1b3a6b]">
          Your new password must meet the system's password requirements.
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-[#b54747]">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col">
        <label
          htmlFor="new-password"
          className="block text-base font-semibold text-[#17263a]"
        >
          New Password
        </label>
        <div className="relative mt-[9px]">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            className="h-14 w-full rounded-[10px] border border-[#17263a29] bg-white pl-[18px] pr-[58px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#17263a99] hover:bg-[#17263a0d]"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <label
          htmlFor="confirm-password"
          className="mt-[22px] block text-base font-semibold text-[#17263a]"
        >
          Confirm New Password
        </label>
        <div className="relative mt-[9px]">
          <input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="h-14 w-full rounded-[10px] border border-[#17263a29] bg-white pl-[18px] pr-[58px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#17263a99] hover:bg-[#17263a0d]"
          >
            {showConfirm ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
        >
          {isSubmitting ? "Resetting…" : "Reset Password"}
        </button>
      </form>
    </AuthLayout>
  );
}