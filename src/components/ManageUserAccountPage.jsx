import { useState } from "react";
import { ChevronLeft } from "./icons";
import AppShell from "./layout/AppShell";
import StatusPill from "./shared/StatusPill";
import ConfirmDialog from "./shared/ConfirmDialog";
const EMPTY_ACCOUNT = { id: null, name: "", role: "", contactNumber: "", status: "Active" };

/**
 * LSB Handicrafts — Manage User Account
 * Figma: Screen #7 (Block/Unblock User Account) + the Staff Role summary
 * section folded into the same page in Screen #11's frames.
 *
 * `account` shape: { id, name, role, contactNumber, status: "Active"|"Blocked" }
 * Status is read straight off the prop — the caller owns the staff list, so a
 * block/unblock flows back down instead of being mirrored in local state.
 * Name/contact number are edited locally and only pushed up via
 * onSaveDetails on submit, same as UpdateProfilePage's own form. The caller
 * renders this with `key={account.id}` (see src/App.jsx) so switching to a
 * different account remounts the form fresh instead of needing an effect to
 * reset it.
 * The default below is only a crash-guard for standalone rendering — the
 * real app (src/App.jsx) always supplies a Supabase-backed account and
 * falls back to the accounts list instead of rendering this with none.
 */
export default function ManageUserAccountPage({
  account = EMPTY_ACCOUNT,
  currentUserEmail,
  onBack,
  onNavigate,
  onSignOut,
  isAdmin = false,
  onChangeRole,
  onStatusChange, // (nextStatus) => void
  onSaveDetails, // ({ name, contactNumber }) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(account.name);
  const [contactNumber, setContactNumber] = useState(account.contactNumber);

  const isActive = account.status === "Active";
  // Blocking is now enforced at login (see src/App.jsx) — blocking your own
  // account here would sign you out next time with no other way back in
  // unless someone else already has access, so it's disabled outright.
  const isSelf = Boolean(account.email) && account.email === currentUserEmail;
  const hasDetailChanges =
    name !== account.name || contactNumber !== account.contactNumber;

  // Both handlers await their write. They used to fire and forget, so a change
  // the database rejected still closed the dialog and left the screen showing a
  // status the server never accepted.
  async function confirmToggle() {
    await onStatusChange?.(isActive ? "Blocked" : "Active");
    setShowConfirm(false);
  }

  async function handleSaveDetails(e) {
    e.preventDefault();
    if (!hasDetailChanges || saving) return;
    setSaving(true);
    await onSaveDetails?.({ name, contactNumber });
    setSaving(false);
  }

  return (
    <AppShell isAdmin={isAdmin} activeTab="accounts" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="w-[600px] max-w-full">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 py-2 text-sm font-medium text-[#5f6875] hover:text-[#17263a]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          User Accounts
        </button>

        <div className="relative mt-3 rounded-2xl border border-[#17263a12] bg-white px-14 py-[52px] shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Manage User Account
          </h1>
          <p className="mt-2 text-base text-[#5f6875]">
            View account status and manage access.
          </p>

          <SectionLabel className="mt-8">Employee Information</SectionLabel>
          <form onSubmit={handleSaveDetails}>
            <div className="mt-5 grid grid-cols-2 gap-8">
              <div>
                <label
                  htmlFor="account-name"
                  className="block text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]"
                >
                  Full Name
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 h-12 w-full rounded-[10px] border border-[#17263a29] bg-white px-3.5 text-[17px] font-medium text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                  Role
                </p>
                <p className="mt-2 flex h-12 items-center text-[17px] font-medium text-[#17263a]">
                  {account.role}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <label
                htmlFor="account-contact"
                className="block text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]"
              >
                Contact Number
              </label>
              <input
                id="account-contact"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="mt-2 h-12 w-full rounded-[10px] border border-[#17263a29] bg-white px-3.5 text-[17px] font-medium text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30"
              />
            </div>
            <button
              type="submit"
              disabled={!hasDetailChanges || saving}
              className="mt-4 h-[46px] rounded-[10px] bg-[#1b3a6b] px-6 text-[15px] font-semibold text-white shadow-[0_2px_5px_rgba(27,58,107,0.26)] transition hover:bg-[#17263a] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>

          <hr className="my-8 border-[#17263a14]" />

          <SectionLabel>Account Access</SectionLabel>
          <div className="mt-5 flex items-center justify-between rounded-[10px] border border-[#17263a14] bg-[#f7f4ec] px-5 py-[18px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                Current Status
              </p>
              <StatusPill status={account.status} variant="badge" className="mt-2" />
            </div>
            <p className="max-w-[220px] text-right text-[13.5px] text-[#5f6875]">
              {isActive
                ? "This account can currently log in to the system."
                : "This account is blocked and cannot log in."}
            </p>
          </div>

          {isActive ? (
            <button
              type="button"
              disabled={isSelf}
              onClick={() => setShowConfirm(true)}
              className="mt-6 h-[52px] w-full rounded-[10px] border border-[#b5474733] text-base font-semibold text-[#b54747] transition hover:bg-[#b5474708] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Block Account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="mt-6 h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a]"
            >
              Unblock Account
            </button>
          )}

          <p className="mt-4 rounded-lg border border-[#17263a12] bg-[#f7f4ec] px-3.5 py-2.5 text-[13px] text-[#5f6875]">
            {isActive && isSelf
              ? "You can't block your own account."
              : "This action will be recorded in the system log."}
          </p>

          <hr className="my-8 border-[#17263a14]" />

          <SectionLabel>Staff Role</SectionLabel>
          <div className="mt-5 flex items-center justify-between rounded-[10px] border border-[#17263a14] bg-[#f7f4ec] px-5 py-[18px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                Current Role
              </p>
              <p className="mt-2 text-[17px] font-semibold text-[#17263a]">
                {account.role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangeRole?.(account)}
            className="mt-4 h-[52px] w-full rounded-[10px] border border-[#17263a33] text-base font-semibold text-[#17263a] transition hover:bg-[#17263a08]"
          >
            Change Role
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={(open) => !open && setShowConfirm(false)}
        title={isActive ? "Block this account?" : "Unblock this account?"}
        subject={account.name}
        description={
          isActive
            ? "They will be signed out and won't be able to sign in again until unblocked."
            : "They will be able to sign in again straight away."
        }
        confirmLabel={isActive ? "Block Account" : "Unblock Account"}
        variant={isActive ? "destructive" : "default"}
        onConfirm={confirmToggle}
      />
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

