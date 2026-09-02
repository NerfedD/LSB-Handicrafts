import { useState } from "react";
import AppShell from "./layout/AppShell";
import { ROLES, initialsOf } from "../utils/staffData";
import StatusPill from "./shared/StatusPill";

const EMPTY_ACCOUNT = { id: null, name: "", role: "", contactNumber: "", status: "Active" };

/**
 * LSB Handicrafts — Assign / Update Staff Role
 * Figma: Screen #11
 *
 * The default below is only a crash-guard for standalone rendering — the
 * real app (src/App.jsx) always supplies a Supabase-backed account.
 */
export default function AssignStaffRolePage({
  account = EMPTY_ACCOUNT,
  onBack,
  onNavigate,
  onSignOut,
  isAdmin = false,
  onSaved,
}) {
  const [newRole, setNewRole] = useState("");

  const canSave = newRole && newRole !== account.role;

  // Persisted through App's updateSelectedAccount, which writes the single row
  // and reports a rejection rather than navigating away regardless.
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    await onSaved?.(newRole);
    setSaving(false);
  }

  const initials = initialsOf(account.name);

  return (
    <AppShell isAdmin={isAdmin} activeTab="accounts" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="w-[520px] max-w-full">
        <button
          type="button"
          onClick={onBack}
          className="py-2 text-sm font-medium text-[#5f6875] hover:text-[#17263a]"
        >
          ← Manage User Account
        </button>

        <div className="mt-3 rounded-2xl border border-[#17263a12] bg-white px-14 py-[52px] shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Staff Role
          </h1>
          <p className="mt-2 text-base text-[#5f6875]">
            Assign or update the role of a staff member.
          </p>

          <div className="mt-8 flex items-center gap-[18px] rounded-xl border border-[#17263a12] bg-[#f7f4ec] px-[22px] py-5">
            <div className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[#1b3a6b] text-base font-bold tracking-[0.64px] text-white shadow-[0_2px_5px_rgba(27,58,107,0.22)]">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-[#17263a]">
                {account.name}
              </p>
              <p className="mt-1 text-sm text-[#5f6875]">
                {account.contactNumber}
              </p>
              <StatusPill status={account.status} variant="badge" className="mt-1.5" />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Role Assignment
            </span>
            <span className="h-px flex-1 bg-[#17263a1a]" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                Current Role
              </p>
              <div className="mt-2.5 flex h-13 items-center rounded-[10px] border border-[#17263a1a] bg-[#17263a0a] px-4 text-base font-semibold text-[#17263a80]">
                {account.role}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className={`mt-2.5 h-13 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[15.5px] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30 ${
                  newRole ? "text-[#17263a]" : "text-[#9aa3ad]"
                }`}
              >
                <option value="" disabled>
                  Select role…
                </option>
                {ROLES.filter((r) => r !== account.role).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="mt-6 border-[#17263a14]" />

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={handleSave}
              className="h-14 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-45"
            >
              {saving ? "Saving…" : "Save Role Change"}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-[52px] w-full rounded-[10px] border border-[#17263a33] text-base font-semibold text-[#17263a] transition hover:bg-[#17263a08]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

