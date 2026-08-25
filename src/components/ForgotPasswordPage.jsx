import { useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import AuthLayout from "./layout/AuthLayout";
import { supabase } from "../lib/supabaseClient";

/**
 * LSB Handicrafts — Forgot Password (request step)
 * Figma: node 10:1346
 *
 * Supabase's real reset flow is just email -> emailed link -> new password
 * (see ResetPasswordPage). There's no in-app "verify identity" step —
 * clicking the link in the email is what proves it's really them, and it
 * lands back in this app already signed into a temporary recovery session.
 */
export default function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="mt-11 flex flex-col items-center text-center">
          <div className="flex size-[68px] items-center justify-center rounded-full border border-[#1b3a6b33] bg-[#1b3a6b12]">
            <Mail className="h-8 w-8 text-[#1b3a6b]" />
          </div>
          <h1 className="mt-7 text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Check Your Email
          </h1>
          <p className="mt-3.5 text-base leading-[1.65] text-[#5f6875]">
            If an account exists for <span className="font-medium text-[#17263a]">{email}</span>,
            we've sent a link to reset the password. Open it on this device
            to continue.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-9 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a]"
          >
            Back to Login
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mt-11">
        <h1 className="text-[32px] font-bold leading-[1.18] tracking-tight text-[#17263a]">
          Forgot Password?
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-[#5f6875]">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <p className="mt-5 text-sm font-medium text-[#b54747]">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col">
        <label
          htmlFor="email"
          className="block text-base font-semibold text-[#17263a]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="mt-[9px] h-14 w-full rounded-[10px] border border-[#17263a29] bg-white px-[18px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 flex items-center gap-1 py-2 text-sm font-medium text-[#5f6875] hover:text-[#17263a]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to Login
      </button>
    </AuthLayout>
  );
}
