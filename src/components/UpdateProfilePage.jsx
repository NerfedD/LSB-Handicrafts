import { useState } from "react";
import { initialsOf } from "../utils/staffData";
import StatusPill from "./shared/StatusPill";

const EMPTY_PROFILE = { name: "", role: "", contactNumber: "", status: "Active" };

/**
 * LSB Handicrafts — Update Profile
 * Figma: Screen #10
 */
export default function UpdateProfilePage({
  profile = EMPTY_PROFILE,
  onBack,
  onSaved,
}) {
  const [name, setName] = useState(profile.name);
  const [contactNumber, setContactNumber] = useState(profile.contactNumber);

  const initials = initialsOf(profile.name);

  // Persisted through App's updateProfile -> the update_own_profile RPC, which
  // is the one write a non-admin is allowed to make. onSaved is async and only
  // navigates away once the database has confirmed the change.
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSaved?.({ name, contactNumber });
    setSaving(false);
  }

  return (
    <div className="mx-auto w-[520px] max-w-full">
      <button
        type="button"
        onClick={onBack}
        className="py-2 text-sm font-medium text-[#5f6875] hover:text-[#17263a]"
      >
        ← Back to My Profile
      </button>

      <div className="mt-3 rounded-2xl border border-[#17263a12] bg-white px-14 py-13 shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
          Update Profile
        </h1>
        <p className="mt-2 text-base text-[#5f6875]">
          Update your personal information.
        </p>

        <div className="mt-8 flex items-center gap-5 rounded-xl border border-[#17263a12] bg-[#f7f4ec] px-6 py-6">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#1b3a6b] text-xl font-bold tracking-[0.8px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.25)]">
            {initials}
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-[#17263a]">
              {profile.name}
            </p>
            <p className="mt-1 text-[14.5px] font-medium text-[#5f6875]">
              {profile.role}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Personal Information
            </span>
            <span className="h-px flex-1 bg-[#17263a1a]" />
          </div>

          <label
            htmlFor="name"
            className="mt-5 block text-[13.5px] font-semibold text-[#17263a]"
          >
            Name <span className="text-[#b54747]">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 h-13 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[17px] text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30"
          />

          <label
            htmlFor="contact"
            className="mt-6 block text-[13.5px] font-semibold text-[#17263a]"
          >
            Contact Number <span className="text-[#b54747]">*</span>
          </label>
          <input
            id="contact"
            type="tel"
            required
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            className="mt-2 h-13 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[17px] text-[#17263a] outline-none transition focus:ring-2 focus:ring-[#1b3a6b]/30"
          />

          <hr className="mt-7 border-[#17263a14]" />

          <div className="mt-7 flex items-center gap-3">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Account Details (Read-Only)
            </span>
            <span className="h-px flex-1 bg-[#17263a1a]" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                Role
              </p>
              <p className="mt-2 text-base font-medium text-[#17263a73]">
                {profile.role}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
                Account Status
              </p>
              <StatusPill status={profile.status} variant="badge" className="mt-2" />
            </div>
          </div>
          <p className="mt-8 text-[13px] text-[#5f687599]">
            Role and account status can only be changed by an administrator.
          </p>

          <hr className="mt-7 border-[#17263a14]" />

          <div className="mt-7 flex flex-col gap-3">
            <button
              type="submit"
              disabled={saving}
              className="h-13 w-full rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-45"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-13 w-full rounded-[10px] border border-[#17263a33] text-base font-semibold text-[#17263a] transition hover:bg-[#17263a08]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
