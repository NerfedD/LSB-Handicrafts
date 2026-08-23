/**
 * Shared shell for authenticated screens (Update Credentials, Create User
 * Account, User Accounts): dark header with nav tabs + Sign Out, warm
 * gradient background, decorative corner glows behind the content.
 *
 * `nav` items only render when provided, so screens that don't need the
 * admin nav (e.g. a plain single-purpose page) can omit it.
 */
export default function AppShell({
  activeTab,
  onNavigate,
  onSignOut,
  children,
}) {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "accounts", label: "User Accounts" },
    { key: "create", label: "Create User Account" },
    { key: "activity", label: "Activity Log" },
    { key: "directory", label: "Staff Directory" },
    { key: "profile", label: "My Profile" },
    { key: "credentials", label: "Update Credentials" },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[linear-gradient(158deg,#ddd8c8_8%,#e8e4d8_25%,#f0edE4_50%,#e9e5da_75%,#dfd9cb_92%)]">
      <header className="flex h-[62px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#17263a] px-6 xl:px-12">
        <div className="flex shrink-0 items-center gap-3.5">
          <div className="flex size-8 items-center justify-center rounded-md border border-white/[0.15] bg-white/10">
            <span className="text-[10px] font-bold tracking-[0.5px] text-white">
              LSB
            </span>
          </div>
          <span className="text-sm font-semibold tracking-[0.14px] text-white/90">
            LSB Handicrafts
          </span>
          <span className="text-[13px] text-white/30">·</span>
          <span className="text-[13px] tracking-[0.13px] text-white/40">
            Internal Management System
          </span>
        </div>

        {onNavigate && (
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onNavigate(tab.key)}
                  className={`shrink-0 whitespace-nowrap rounded-[7px] border px-[15px] py-[6px] text-[13px] tracking-[0.13px] transition ${
                    isActive
                      ? "border-white/[0.16] bg-white/[0.11] font-semibold text-white/[0.92]"
                      : "border-transparent font-normal text-white/[0.46] hover:text-white/70"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="shrink-0 whitespace-nowrap rounded-[7px] border border-white/[0.15] px-4 py-[7px] text-[13px] font-medium text-white/60 transition hover:text-white/90"
        >
          Sign Out
        </button>
      </header>

      <main className="relative flex flex-1 items-start justify-center overflow-y-auto px-6 py-10 xl:px-16">
        <div
          className="pointer-events-none absolute size-[420px] rounded-full opacity-70"
          style={{
            top: "-102px",
            right: "-100px",
            background:
              "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 58%)",
          }}
        />
        <div
          className="pointer-events-none absolute size-[360px] rounded-full opacity-70"
          style={{
            bottom: "-40px",
            left: "-60px",
            background:
              "radial-gradient(circle at 30% 70%, rgba(232,220,200,0.45), rgba(232,220,200,0) 60%)",
          }}
        />
        {children}
      </main>
    </div>
  );
}