import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import AppShell from "./layout/AppShell";
import { SAMPLE_STAFF, initialsOf } from "../utils/staffData";

const AVATAR_COLORS = [
  "#653eb5",
  "#166b59",
  "#8a5600",
  "#1746d1",
  "#1b3a6b",
  "#653eb5",
];

/**
 * LSB Handicrafts — Staff Directory
 * Figma: Screen #12
 */
export default function StaffDirectoryPage({
  staff = SAMPLE_STAFF,
  onNavigate,
  onSignOut,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, query]);

  return (
    <AppShell activeTab="directory" onNavigate={onNavigate} onSignOut={onSignOut}>
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

        <div className="mt-6 overflow-hidden rounded-[14px] border border-[#17263a1a] bg-white shadow-[0_1px_4px_rgba(23,38,58,0.06)]">
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
              No staff members match &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((member, i) => (
              <div
                key={member.id}
                className="grid grid-cols-[1.3fr_1fr_1fr] items-center border-t border-[#17263a0f] px-7 py-4 first:border-t-0"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex size-10 items-center justify-center rounded-full text-[13px] font-bold tracking-[0.52px] text-white"
                    style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  >
                    {initialsOf(member.name)}
                  </div>
                  <span className="text-[15.5px] font-semibold tracking-[-0.0775px] text-[#17263a]">
                    {member.name}
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
        </div>
      </div>
    </AppShell>
  );
}
