import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { Plus, MoreVertical } from "./icons";
import AppShell from "./layout/AppShell";
import { ROLES } from "../utils/staffData";

// Case-insensitive, matching App.jsx and the lower(email) predicates in the
// database. See the note on sameEmail in App.jsx.
const sameEmail = (a, b) =>
  !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
import StatusPill, { SuperAdminPill } from "./shared/StatusPill";
import ConfirmDialog from "./shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * LSB Handicrafts — User Accounts
 * Figma: node 29:713 / 71:204 (list + filters), 71:410 (filters applied)
 *
 * `users` comes from the `staff` table in Supabase (see src/App.jsx).
 *
 * Two rows are protected from the actions menu, both mirroring a rule the
 * database enforces independently (see the staff policies in schema.sql):
 *   - the signed-in admin's own row, which can't be deleted from here;
 *   - the super administrator, which no admin may delete, block or edit.
 * Hiding the menu items is a courtesy so nobody is offered an action that
 * would be rejected -- it is not the protection itself.
 */
export default function UserAccountsPage({
  users = [],
  // False while the staff read is still in flight. Without it this screen
  // renders its empty state over a list that simply hasn't arrived yet.
  isLoaded = true,
  currentUserEmail,
  onNavigate,
  onSignOut,
  isAdmin = false,
  onCreateAccount,
  onRowAction,
}) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ role: "", status: "" });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // The row menu's open state, outside-click handling, Escape key and
  // flip-when-near-the-bottom logic all used to live here by hand. Radix's
  // DropdownMenu does all of it, plus the focus management and arrow-key
  // navigation the hand-rolled version never had.

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
    <AppShell isAdmin={isAdmin} activeTab="accounts" onNavigate={onNavigate} onSignOut={onSignOut}>
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
        {/* No overflow-hidden here: it used to clip the row menu the moment
            the menu extended past the card, which is every time you opened
            the last row's. The header and footer round their own outer
            corners instead, so the card keeps its shape without clipping. */}
        <Card variant="raised" clip={false} className="mt-4">
          <div className="grid grid-cols-[1fr_284px_178px_48px] rounded-t-2xl border-b border-[#17263a14] bg-[#f7f4ec] px-7 py-3">
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
              {/* Distinguishing these matters: this screen used to blame the
                  filters even when none were applied and the table was simply
                  empty or still loading. */}
              {!isLoaded
                ? "Loading accounts…"
                : hasActiveFilters
                  ? "No accounts match the selected filters."
                  : "No user accounts yet."}
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
                <span className="flex items-center gap-2 text-[15px] text-[#5f6875]">
                  {user.role}
                  {user.isSuperAdmin && <SuperAdminPill />}
                </span>
                <StatusPill status={user.status} variant="badge" />
                <div className="flex justify-end">
                  {user.isSuperAdmin ? (
                    // No menu at all. The super administrator can't be edited,
                    // blocked or deleted by anyone else, and the database
                    // rejects all three, so offering them would be a lie.
                    <span
                      className="px-1 text-[#5f687599]"
                      title="The super administrator account is protected."
                    >
                      &mdash;
                    </span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 text-[#5f6875] hover:bg-[#17263a0d]"
                          aria-label={`Actions for ${user.name}`}
                        >
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-40">
                        <DropdownMenuItem onSelect={() => onRowAction?.("edit", user)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            onRowAction?.(
                              user.status === "Active" ? "block" : "unblock",
                              user
                            )
                          }
                        >
                          {user.status === "Active" ? "Block" : "Unblock"}
                        </DropdownMenuItem>
                        {!sameEmail(user.email, currentUserEmail) && (
                          <DropdownMenuItem
                            destructive
                            onSelect={() => setPendingDelete(user)}
                          >
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))
          )}

          <div className="flex items-center justify-between rounded-b-2xl border-t border-[#17263a0f] bg-[#fafaf8] px-7 py-3">
            <span className="text-[13px] text-[#5f687599]">
              {filtered.length} account{filtered.length === 1 ? "" : "s"}{" "}
              registered
            </span>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this account?"
        subject={pendingDelete?.name}
        description="This removes their access to the system. This cannot be undone."
        confirmLabel="Delete Account"
        busy={deleting}
        onConfirm={async () => {
          // Awaited so the dialog stays open, and the row stays on screen,
          // until the database has actually accepted the delete.
          setDeleting(true);
          await onRowAction?.("delete", pendingDelete);
          setDeleting(false);
          setPendingDelete(null);
        }}
      />
    </AppShell>
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