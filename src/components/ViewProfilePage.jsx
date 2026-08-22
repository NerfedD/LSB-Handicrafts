import AppShell from "./layout/AppShell";
import { DEFAULT_PROFILE, initialsOf } from "../utils/staffData";


/**
 * LSB Handicrafts — My Profile (view)
 * Figma: Screen #9
 */
export default function ViewProfilePage({
  profile = DEFAULT_PROFILE,
  onNavigate,
  onSignOut,
  onUpdateProfile,
  onGoToCredentials,
}) {
  const initials = initialsOf(profile.name);

  return (
    <AppShell activeTab="profile" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="w-[520px] max-w-full rounded-2xl border border-[#17263a12] bg-white px-14 py-13 shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
          My Profile
        </h1>
        <p className="mt-2 text-base text-[#5f6875]">
          View your registered account information.
        </p>

        <div className="mt-8 flex items-center gap-5 rounded-xl border border-[#17263a12] bg-[#f7f4ec] px-6 py-5.5">
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

        <div className="mt-8 flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
            Account Information
          </span>
          <span className="h-px flex-1 bg-[#17263a1a]" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Contact Number
            </p>
            <p className="mt-2 text-[17px] font-medium text-[#17263a]">
              {profile.contactNumber}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Account Status
            </p>
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#287a5538] bg-[#287a5517] px-3.5 py-1.5 text-[13.5px] font-medium text-[#287a55]">
              <span className="size-1.5 rounded-full bg-[#287a55]" />
              {profile.status}
            </span>
          </div>
        </div>

        <hr className="mt-7 border-[#17263a14]" />

        <button
          type="button"
          onClick={onUpdateProfile}
          className="mt-7 h-[52px] w-full rounded-[10px] border border-[#17263a33] text-base font-semibold text-[#17263a] transition hover:bg-[#17263a08]"
        >
          Update Profile
        </button>

        <p className="mt-4.5 text-center text-[13.5px] text-[#5f687599]">
          To update your username or password,{" "}
          <button
            type="button"
            onClick={onGoToCredentials}
            className="font-medium text-[#1b3a6b] underline underline-offset-2 hover:text-[#17263a]"
          >
            go to Update Credentials
          </button>
          .
        </p>
      </div>
    </AppShell>
  );
}
