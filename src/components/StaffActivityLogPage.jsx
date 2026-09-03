import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { initialsOf } from "../utils/staffData";
import {
  ACTION_TYPES,
  ACTION_STYLES,
  SAMPLE_ENTRIES,
} from "../utils/activityData";

const EMPTY_FILTERS = { staff: "", action: "", from: "", to: "" };

/** "August 22, 2026" -> "2026-08-22" so it compares against <input type="date">. */
function toISODate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

/**
 * LSB Handicrafts — Staff Activity Log
 * Figma: Screen #8
 */
export default function StaffActivityLogPage({
  entries = SAMPLE_ENTRIES,
  staff = [],
  // Whether `staff` has actually been read yet — an empty list mid-load would
  // otherwise make the Staff Member filter look like there are no staff at all.
  isLoaded = true,
}) {
  const [staffFilter, setStaffFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (applied.staff && e.staff !== applied.staff) return false;
      if (applied.action && e.type !== applied.action) return false;
      if (applied.from || applied.to) {
        const iso = toISODate(e.date);
        if (!iso) return false;
        if (applied.from && iso < applied.from) return false;
        if (applied.to && iso > applied.to) return false;
      }
      return true;
    });
  }, [entries, applied]);

  const hasActiveFilters = Boolean(
    applied.staff || applied.action || applied.from || applied.to
  );

  function applyFilters() {
    setApplied({ staff: staffFilter, action: actionFilter, from: fromDate, to: toDate });
  }

  function clearFilters() {
    setStaffFilter("");
    setActionFilter("");
    setFromDate("");
    setToDate("");
    setApplied(EMPTY_FILTERS);
  }

  return (
    <div className="mx-auto w-full max-w-[1160px]">
      <div className="mt-0 rounded-xl border border-[#17263a12] bg-white px-7 py-5 shadow-[0_2px_5px_rgba(17,30,50,0.05)]">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
            Filter Activity
          </span>
          <span className="h-px flex-1 bg-[#17263a14]" />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-[188px]">
            <label className="block text-[13px] font-semibold text-[#17263a]">
              Staff Member
            </label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              disabled={!isLoaded}
              className="mt-2 h-11 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[15px] text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30 disabled:opacity-60"
            >
              <option value="">{isLoaded ? "All Staff" : "Loading staff…"}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[172px]">
            <label className="block text-[13px] font-semibold text-[#17263a]">
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="mt-2 h-11 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[15px] text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30"
            >
              <option value="">All Actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[152px]">
            <label className="block text-[13px] font-semibold text-[#17263a]">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-2 h-11 w-full rounded-[10px] border border-[#17263a29] bg-white px-3 text-sm text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30"
            />
          </div>
          <span className="pb-3 text-[#17263a4d]">→</span>
          <div className="w-[152px]">
            <label className="block text-[13px] font-semibold text-[#17263a]">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-2 h-11 w-full rounded-[10px] border border-[#17263a29] bg-white px-3 text-sm text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={applyFilters}
              className="h-11 rounded-[10px] bg-[#1b3a6b] px-6 text-[15px] font-semibold tracking-[0.3px] text-white shadow-[0_2px_5px_rgba(27,58,107,0.26)] transition hover:bg-[#17263a]"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 rounded-[10px] border border-[#17263a1a] px-5 text-[15px] font-medium text-[#17263a59] transition hover:text-[#17263a]"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <Card variant="raised" className="mt-5">
        <div className="grid grid-cols-[1fr_1.1fr_200px] border-b border-[#17263a14] bg-[#f7f4ec] px-7 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
            Staff Member
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
            Action
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
            Timestamp
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-7 py-10 text-center text-sm text-[#5f6875]">
            {/* Blaming the filters when none are applied tells the user to go
                looking for a filter that isn't there. */}
            {hasActiveFilters
              ? "No activity matches the selected filters."
              : "No activity has been recorded yet."}
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[1fr_1.1fr_200px] items-center border-t border-[#17263a0f] px-7 py-4 first:border-t-0"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-[34px] items-center justify-center rounded-full border border-[#17263a1a] bg-[#17263a12] text-[11.5px] font-bold tracking-[0.23px] text-[#17263a]">
                  {initialsOf(entry.staff)}
                </div>
                <span className="text-[15.5px] font-medium text-[#17263a]">
                  {entry.staff}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[15px] text-[#17263a]">{entry.action}</span>
                <span
                  className={`rounded-md border px-3 py-1 text-[11.5px] font-semibold tracking-[0.23px] ${ACTION_STYLES[entry.type]}`}
                >
                  {entry.type}
                </span>
              </div>
              <div>
                <p className="text-[14.5px] font-medium text-[#17263a]">{entry.date}</p>
                <p className="mt-1 text-[13px] text-[#5f6875]">{entry.time}</p>
              </div>
            </div>
          ))
        )}

        <div className="border-t border-[#17263a0f] bg-[#fafaf8] px-7 py-3">
          <span className="text-[13px] text-[#5f687599]">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · Read-only
          </span>
        </div>
      </Card>
    </div>
  );
}
