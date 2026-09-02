import { useMemo, useState } from "react";
import { Search } from "./icons";
import AppShell from "./layout/AppShell";
import { initialsOf } from "../utils/staffData";
import { avatarColorOf } from "./shared/avatarColors";
import { SuperAdminPill } from "./shared/StatusPill";
import { Card } from "@/components/ui/card";

// This screen used to keep its own array of hex avatar colours and apply them
// by ROW INDEX. Two consequences: the same person had a different colour here
// than on every other screen, and their colour changed as soon as the list was
// filtered. shared/avatarColors picks from the name instead, so it is stable.
// (That private array also listed #653eb5 twice and dropped #b54747.)

/**
 * LSB Handicrafts — Staff Directory
 * Figma: Screen #12
 */
export default function StaffDirectoryPage({
  staff = [],
  isLoaded = true,
  onNavigate,
  onSignOut,
  isAdmin = false,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, query]);

  return (
    <AppShell isAdmin={isAdmin} activeTab="directory" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="w-[860px] max-w-full">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#17263a]">
          Staff Directory
        </h1>
        <p className="mt-2 text-base text-[#5f6875]">
          View staff roles and contact information.
        </p>

        <div className="mt-8 rounded-[14px] border border-[#17263a1a] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(23,38,58,0.06)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#17263a80]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="h-12 w-full rounded-[10px] border border-[#17263a1f] bg-[#f7f4ec] pl-11 pr-4 text-[15.5px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30"
            />
          </div>
        </div>

        <Card className="mt-6">
          <div className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-[#17263a14] bg-[#f7f4ec] px-7 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#5f6875]">
              Name
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#5f6875]">
              Role
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#5f6875]">
              Contact Number
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-7 py-10 text-center text-sm text-[#5f6875]">
              {/* The only branch here used to be the search one, so an empty
                  directory rendered the literal text: No staff members match "". */}
              {!isLoaded
                ? "Loading staff…"
                : query.trim()
                  ? `No staff members match “${query}”.`
                  : "No staff members yet."}
            </div>
          ) : (
            filtered.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[1.3fr_1fr_1fr] items-center border-t border-[#17263a0f] px-7 py-4 first:border-t-0"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full text-[13px] font-bold tracking-[0.52px] text-white ${avatarColorOf(
                      member.name
                    )}`}
                  >
                    {initialsOf(member.name)}
                  </div>
                  <span className="flex items-center gap-2 text-[15.5px] font-semibold tracking-[-0.0775px] text-[#17263a]">
                    {member.name}
                    {member.isSuperAdmin && <SuperAdminPill />}
                  </span>
                </div>
                <span className="text-[15px] font-medium text-[#5f6875]">
                  {member.role}
                </span>
                <span className="text-[15px] text-[#5f6875]">
                  {member.contactNumber}
                </span>
              </div>
            ))
          )}

          <div className="border-t border-[#17263a0f] px-7 py-3">
            <span className="text-[13px] text-[#5f687599]">
              {filtered.length} staff member{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
