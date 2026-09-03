import { useState } from "react";
import { ChevronLeft, AlertCircle } from "./icons";
import AuthLayout from "./layout/AuthLayout";

/**
 * LSB Handicrafts — Verify Identity (security question step)
 * Figma: node 10:1426 (default), 12:1929 (incorrect-answer error variant)
 */
export default function VerifyIdentityPage({
  securityQuestion = "What was the name of your elementary school?",
  onBack,
  onVerified,
  onRequestAdminAssistance,
}) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(false);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      onVerified?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mt-11">
        <h1 className="text-[32px] font-bold leading-[1.18] tracking-tight text-[#17263a]">
          Verify Your Identity
        </h1>
        <p className="mt-3 text-base leading-[1.65] text-[#5f6875]">
          Please verify your identity before creating a new password.
        </p>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-r-lg border-l-2 border-[#b54747] bg-[#b5474708] px-4 py-3">
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#b54747]" />
          <p className="text-[15px] leading-6 text-[#b54747]">
            That answer doesn't match our records. Please try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col">
        <p className="text-base font-semibold text-[#17263a]">
          Security Question
        </p>
        <div className="mt-2 rounded-[10px] border border-[#17263a1a] bg-[#f0ede4] px-4 py-3 text-base text-[#17263a]">
          {securityQuestion}
        </div>

        <label
          htmlFor="answer"
          className="mt-6 block text-base font-semibold text-[#17263a]"
        >
          Answer
        </label>
        <input
          id="answer"
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter your answer"
          className={`mt-2 h-13 w-full rounded-[10px] border bg-white px-4 text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30 ${
            error ? "border-[#b5474780]" : "border-[#17263a29]"
          }`}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-7 h-13 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
        >
          {isSubmitting ? "Verifying…" : "Verify Identity"}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 flex items-center gap-1 py-2 text-sm font-medium text-[#5f6875] hover:text-[#17263a]"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mt-6 border-t border-[#17263a14] pt-6">
        <p className="text-[13.5px] text-[#5f6875]">
          Need administrator assistance?
        </p>
        <button
          type="button"
          onClick={onRequestAdminAssistance}
          className="mt-3 h-12 w-full rounded-[10px] border border-[#17263a33] text-[15px] font-medium text-[#17263a] transition hover:bg-[#17263a08]"
        >
          Request Admin Assistance
        </button>
      </div>
    </AuthLayout>
  );
}