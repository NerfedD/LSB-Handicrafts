import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import AuthLayout from "./layout/AuthLayout";

/**
 * LSB Handicrafts — Forgot Password (request step)
 * Figma: node 10:1346
 */
export default function ForgotPasswordPage({ onBack, onContinue }) {
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      onContinue?.(identifier);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mt-11">
        <h1 className="text-[32px] font-bold leading-[1.18] tracking-tight text-[#17263a]">
          Forgot Password?
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-[#5f6875]">
          Enter your username or email to begin the password recovery
          process.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col">
        <label
          htmlFor="identifier"
          className="block text-base font-semibold text-[#17263a]"
        >
          Username or Email
        </label>
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Enter your username or email"
          className="mt-[9px] h-14 w-full rounded-[10px] border border-[#17263a29] bg-white px-[18px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
        >
          {isSubmitting ? "Please wait…" : "Continue"}
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