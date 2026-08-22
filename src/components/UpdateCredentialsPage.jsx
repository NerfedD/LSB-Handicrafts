import { useState } from "react";
import { Eye, EyeOff, Info, CheckCircle2 } from "lucide-react";
import AppShell from "./layout/AppShell";

/**
 * LSB Handicrafts — Update Credentials
 * Figma: node 14:2040 (form), 14:2328 (success)
 */
export default function UpdateCredentialsPage({
  onNavigate,
  onSignOut,
  onCancel,
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/account/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      if (!res.ok) {
        setError("Couldn't update your credentials. Please try again.");
        return;
      }
      setSucceeded(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <AppShell activeTab="credentials" onNavigate={onNavigate} onSignOut={onSignOut}>
        <div className="relative flex w-[600px] max-w-full flex-col items-center rounded-2xl border border-[#17263a12] bg-white px-14 py-13 text-center shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
          <div className="flex size-[68px] items-center justify-center rounded-full border border-[#287a5538] bg-[#287a5514]">
            <CheckCircle2 className="h-8 w-8 text-[#287a55]" />
          </div>
          <h1 className="mt-7 text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Credentials Updated Successfully
          </h1>
          <p className="mt-3.5 text-base text-[#5f6875]">
            Your account credentials have been updated.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("accounts")}
            className="mt-9 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a]"
          >
            Done
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="credentials" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="relative w-[600px] max-w-full rounded-2xl border border-[#17263a12] bg-white px-14 py-13 shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
        <div className="h-[2.5px] w-7 rounded bg-[#1b3a6b]" />
        <h1 className="mt-5 text-[32px] font-bold leading-tight tracking-tight text-[#17263a]">
          Update Credentials
        </h1>
        <p className="mt-2.5 text-base text-[#5f6875]">
          Update your username or password to keep your account secure.
        </p>

        {error && (
          <p className="mt-5 text-sm font-medium text-[#b54747]">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-9 flex flex-col">
          <SectionLabel>Verify Current Password</SectionLabel>
          <label
            htmlFor="current-password"
            className="mt-5 block text-base font-semibold text-[#17263a]"
          >
            Current Password
          </label>
          <PasswordField
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            placeholder="Enter your current password"
          />

          <hr className="mt-7 border-[#17263a14]" />

          <SectionLabel className="mt-6">Update Username</SectionLabel>
          <label
            htmlFor="new-username"
            className="mt-5 block text-base font-semibold text-[#17263a]"
          >
            New Username
          </label>
          <input
            id="new-username"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter your new username"
            className="mt-[9px] h-14 w-full rounded-[10px] border border-[#17263a29] bg-white px-[18px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
          />
          <p className="mt-2 text-[13.5px] text-[#5f6875]">
            Username must be unique across the system.
          </p>

          <hr className="mt-6 border-[#17263a14]" />

          <SectionLabel className="mt-6">Update Password</SectionLabel>
          <div className="mt-5 flex items-start gap-2.5 rounded-[9px] border border-[#1b3a6b1f] bg-[#dce8ff] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1b3a6b]" />
            <p className="text-[13px] leading-[1.6] text-[#1b3a6b]">
              Your new password must meet the system's password requirements.
            </p>
          </div>

          <label
            htmlFor="new-password"
            className="mt-[22px] block text-base font-semibold text-[#17263a]"
          >
            New Password
          </label>
          <PasswordField
            id="new-password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            placeholder="Enter your new password"
          />

          <label
            htmlFor="confirm-password"
            className="mt-[22px] block text-base font-semibold text-[#17263a]"
          >
            Confirm New Password
          </label>
          <PasswordField
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            placeholder="Re-enter your new password"
          />

          <div className="mt-9 flex gap-3.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-14 flex-1 rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-14 rounded-[10px] border border-[#17263a2e] px-7 text-base font-medium text-[#17263a] transition hover:bg-[#17263a08]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#17263a1a]" />
    </div>
  );
}

function PasswordField({ id, value, onChange, show, onToggle, placeholder }) {
  return (
    <div className="relative mt-[9px]">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[10px] border border-[#17263a29] bg-white pl-[18px] pr-[58px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#17263a99] hover:bg-[#17263a0d]"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}