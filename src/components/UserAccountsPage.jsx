import { useMemo, useState } from "react";
import { Plus, MoreVertical } from "lucide-react";
import AppShell from "./layout/AppShell";
import { ROLES, SAMPLE_STAFF } from "../utils/staffData";

/**
 * LSB Handicrafts — User Accounts
 * Figma: node 29:713 / 71:204 (list + filters), 71:410 (filters applied)
 *
 * `users` defaults to the sample data seen in Figma; pass real data from
 * your API once that's wired up.
 */
export default function UserAccountsPage({
  users = SAMPLE_STAFF,
  onNavigate,
  onSignOut,
  onCreateAccount,
  onRowAction,
}) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ role: "", status: "" });
  const [openMenuId, setOpenMenuId] = useState(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (appliedFilters.role && u.role !== appliedFilters.role) return false;
      if (appliedFilters.status && u.status !== appliedFilters.status)
        return false;
      return true;
    });
  }, [users, appliedFilters]);

  function applyFilters() {
    setAppliedFilters({ role: roleFilter, status: statusFilter });
  }

  function clearFilters() {
    setRoleFilter("");
    setStatusFilter("");
    setAppliedFilters({ role: "", status: "" });
  }

  const hasActiveFilters = appliedFilters.role || appliedFilters.status;

  return (
    <AppShell activeTab="accounts" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="w-[960px] max-w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#17263a]">
              User Accounts
            </h1>
            <p className="mt-2 text-base text-[#5f6875]">
              View and manage registered system users.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateAccount}
            className="mt-1.5 flex h-[46px] items-center gap-2 rounded-[10px] bg-[#1b3a6b] px-[22px] text-[15px] font-semibold tracking-[0.3px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.24)] transition hover:bg-[#17263a]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create User Account
          </button>
        </div>

        {/* Filters */}
        <div className="mt-8 rounded-xl border border-[#17263a12] bg-white px-7 py-5 shadow-[0_2px_5px_rgba(17,30,50,0.05)]">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Filter Users
            </span>
            <span className="h-px flex-1 bg-[#17263a14]" />
          </div>
          <div className="mt-4 flex items-end gap-3.5">
            <div className="w-[200px]">
              <label className="block text-[13px] font-semibold text-[#17263a]">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-2 h-[46px] w-full rounded-[10px] border border-[#17263a29] bg-white px-3.5 text-[15px] text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30"
              >
                <option value="">All Roles</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[172px]">
              <label className="block text-[13px] font-semibold text-[#17263a]">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-2 h-[46px] w-full rounded-[10px] border border-[#17263a29] bg-white px-3.5 text-[15px] text-[#17263a] outline-none focus:ring-2 focus:ring-[#1b3a6b]/30"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={applyFilters}
                className="h-[46px] rounded-[10px] bg-[#1b3a6b] px-[22px] text-[15px] font-semibold tracking-[0.3px] text-white shadow-[0_2px_5px_rgba(27,58,107,0.26)] transition hover:bg-[#17263a]"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="h-[46px] rounded-[10px] border border-[#17263a1a] px-5 text-[15px] font-medium text-[#17263a59] transition hover:text-[#17263a]"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mt-3.5 flex items-center gap-2.5">
            <span className="text-[13px] text-[#5f6875]">Active filters:</span>
            {appliedFilters.role && (
              <FilterChip
                label={`Role: ${appliedFilters.role}`}
                onRemove={() => {
                  setRoleFilter("");
                  setAppliedFilters((f) => ({ ...f, role: "" }));
                }}
              />
            )}
            {appliedFilters.status && (
              <FilterChip
                label={`Status: ${appliedFilters.status}`}
                onRemove={() => {
                  setStatusFilter("");
                  setAppliedFilters((f) => ({ ...f, status: "" }));
                }}
              />
            )}
            <span className="ml-auto text-[13px] text-[#5f687599]">
              Showing {filtered.length} of {users.length} accounts
            </span>
          </div>
        )}

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#17263a12] bg-white shadow-[0_4px_32px_rgba(17,30,50,0.08),0_1px_6px_rgba(17,30,50,0.05)]">
          <div className="grid grid-cols-[1fr_284px_178px_48px] border-b border-[#17263a14] bg-[#f7f4ec] px-7 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Name
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Role
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
              Status
            </span>
            <span />
          </div>

          {filtered.length === 0 ? (
            <div className="px-7 py-10 text-center text-sm text-[#5f6875]">
              No accounts match the selected filters.
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                className="relative grid grid-cols-[1fr_284px_178px_48px] items-center border-t border-[#17263a0f] px-7 py-[15px] first:border-t-0"
              >
                <span className="text-base font-medium tracking-[-0.16px] text-[#17263a]">
                  {user.name}
                </span>
                <span className="text-[15px] text-[#5f6875]">{user.role}</span>
                <StatusBadge status={user.status} />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenuId((id) => (id === user.id ? null : user.id))
                    }
                    className="rounded p-1 text-[#5f6875] hover:bg-[#17263a0d]"
                    aria-label={`Actions for ${user.name}`}
                  >
                    <MoreVertical className="h-[18px] w-[18px]" />
                  </button>
                  {openMenuId === user.id && (
                    <div className="absolute right-7 top-12 z-10 w-40 overflow-hidden rounded-lg border border-[#17263a1a] bg-white shadow-lg">
                      {["Edit", user.status === "Active" ? "Block" : "Unblock", "Delete"].map(
                        (action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onRowAction?.(action.toLowerCase(), user);
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-[#17263a08] ${
                              action === "Delete"
                                ? "text-[#b54747]"
                                : "text-[#17263a]"
                            }`}
                          >
                            {action}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <div className="flex items-center justify-between border-t border-[#17263a0f] bg-[#fafaf8] px-7 py-3">
            <span className="text-[13px] text-[#5f687599]">
              {filtered.length} account{filtered.length === 1 ? "" : "s"}{" "}
              registered
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }) {
  const isActive = status === "Active";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium ${
        isActive
          ? "border-[#287a5538] bg-[#287a5517] text-[#287a55]"
          : "border-[#b5474733] bg-[#b5474714] text-[#b54747]"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isActive ? "bg-[#287a55]" : "bg-[#b54747]"
        }`}
      />
      {status}
    </span>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-[#1b3a6b33] bg-[#dce8ff] py-1 pl-3 pr-2 text-[13px] font-medium text-[#1b3a6b]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="px-0.5 text-sm leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </span>
  );
}