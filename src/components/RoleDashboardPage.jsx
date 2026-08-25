import { LogOut } from "lucide-react";
import { initialsOf } from "../utils/staffData";

// A rough preview of what each role will eventually be able to do, just so
// this placeholder isn't a completely empty page. Purely descriptive —
// none of it is wired to anything yet.
const ROLE_PREVIEWS = {
  Manager: [
    "Approve orders and deliveries",
    "Review staff activity",
    "Oversee inventory levels",
  ],
  "Sales Staff": [
    "Create and track customer orders",
    "Look up product stock",
  ],
  "Production Staff": [
    "Update inventory as items are made",
    "Flag low-stock items",
  ],
  "Delivery Staff": [
    "View assigned deliveries",
    "Mark deliveries as completed",
  ],
};

/**
 * Temporary landing page for every role except Admin (which gets the full
 * AdminDashboard). There's no real Manager/Sales/Production/Delivery
 * dashboard yet — this just confirms the sign-in worked, shows who they
 * are, and gives them a way to sign out. Replace it with a real screen
 * role by role as those get built (see src/App.jsx for the routing).
 */
export default function RoleDashboardPage({ profile, onSignOut }) {
  const initials = initialsOf(profile?.name);
  const preview = ROLE_PREVIEWS[profile?.role] || [];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[linear-gradient(158deg,#ddd8c8_8%,#e8e4d8_25%,#f0edE4_50%,#e9e5da_75%,#dfd9cb_92%)]">
      <header className="flex h-[62px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#17263a] px-6 xl:px-12">
        <div className="flex items-center gap-3.5">
          <div className="flex size-8 items-center justify-center rounded-md border border-white/[0.15] bg-white/10">
            <span className="text-[10px] font-bold tracking-[0.5px] text-white">
              LSB
            </span>
          </div>
          <span className="text-sm font-semibold tracking-[0.14px] text-white/90">
            LSB Handicrafts
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 rounded-[7px] border border-white/[0.15] px-4 py-[7px] text-[13px] font-medium text-white/60 transition hover:text-white/90"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-[480px] max-w-full rounded-2xl border border-[#17263a12] bg-white px-12 py-12 text-center shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#1b3a6b] text-xl font-bold tracking-[0.8px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.25)]">
            {initials}
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#17263a]">
            Welcome, {profile?.name}
          </h1>
          <p className="mt-1.5 text-[15px] font-medium text-[#5f6875]">
            {profile?.role}
          </p>

          <div className="mt-7 rounded-xl border border-[#17263a14] bg-[#f7f4ec] px-6 py-5 text-left">
            <p className="text-[13px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Coming Soon
            </p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#5f6875]">
              A dedicated {profile?.role} dashboard isn't built yet.
              {preview.length > 0 && " Once it is, you'll be able to:"}
            </p>
            {preview.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-[14.5px] text-[#17263a]">
                {preview.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[#1b3a6b]" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-6 text-[13px] text-[#5f687599]">
            Contact your administrator if you think this is a mistake.
          </p>
        </div>
      </main>
    </div>
  );
}
