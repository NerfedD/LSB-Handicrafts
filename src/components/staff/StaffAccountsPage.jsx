import { useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import useTablePage from "../../hooks/useTablePage";
import { DotsThree, DownloadSimple, Key, PencilSimple, Plus, Prohibit, Users, UserGear } from "../icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import {
  BulkActions,
  DataCard,
  EmptyState,
  FilterBar,
  FilterSelect,
  FilterSpacer,
  Page,
  PageHeader,
  SearchField,
  StatCard,
  StatCards,
  TablePagination,
} from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { toast } from "@/components/ui/sonner";
import { exportUsers } from "@/lib/exports";
import { supabase } from "../../lib/supabaseClient";
import { matches } from "../../utils/search";
import { sameEmail } from "../../utils/email";
import { whenLabel } from "../../utils/activityLog";
import { roleLabel, signInState } from "../../utils/copy";
import { ROLES } from "../../utils/staffData";

/**
 * User Management, drawn to the "3 · User Management" board:
 *
 *   PageHeader (Export, Add user) → four compact StatCards → a DataCard with
 *   the FilterBar (search, Role, Status, bulk actions) and the accounts table
 *   (Name, Email, Role, Can sign in, Last active, row actions) → pagination.
 *
 * "Last active" is the newest activity-log entry by that person. Bulk actions
 * are shown as the board draws them but stay disabled: accounts change one at
 * a time, on the account's own screen.
 *
 * "Reset password" in a row's menu sends the reset link to that account's own
 * email -- the same call as "Send password reset" on Manage account -- so the
 * administrator starts the recovery without ever seeing the password.
 */
const STATUS_LABEL = { Yes: "Active", Blocked: "Suspended", "Not set up": "Not set up" };

export default function StaffAccountsPage({
  users = [],
  activity = [],
  isLoaded = true,
  loadError = null,
  onRetry,
  onGoToDashboard,
  currentUserEmail,
  onManage,
  onChangeRole,
  onAdd,
  initialFilter,
  change = null,
}) {
  const [query, setQuery] = useUrlState("query", "", "staff");
  const [status, setStatus] = useUrlState("tab", initialFilter ?? "all", "staff");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState(() => new Set());

  async function sendPasswordReset(user) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        toast.error("That did not send. Too many resets in a row are refused for a few minutes — wait, then try again.");
        return;
      }
      toast.success(`Reset link sent to ${user.email}.`);
    } catch {
      toast.error("We could not reach the system, so no reset link was sent.");
    }
  }

  const lastSeen = useMemo(() => {
    const map = new Map();
    for (const entry of activity) {
      if (entry.at && !map.has(entry.who)) map.set(entry.who, entry.at);
    }
    return map;
  }, [activity]);

  const rows = useMemo(() => users.map((user) => ({ user, signIn: signInState(user) })), [users]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      yes: rows.filter((r) => r.signIn.label === "Yes").length,
      blocked: rows.filter((r) => r.signIn.label === "Blocked").length,
      notSetUp: rows.filter((r) => r.signIn.label === "Not set up").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const wanted = { yes: "Yes", blocked: "Blocked", "not-set-up": "Not set up" }[status];
    return rows
      .filter(({ user, signIn }) => {
        if (wanted && signIn.label !== wanted) return false;
        if (role !== "all" && user.role !== role) return false;
        return matches(query, user.name, user.email, user.username, user.role);
      })
      .sort((a, b) => String(a.user.name).localeCompare(String(b.user.name)));
  }, [rows, status, role, query]);

  const paged = useTablePage(filtered);
  const visibleIds = paged.visible.map(({ user }) => user.id);
  const selectedOnPage = visibleIds.filter((id) => selected.has(id)).length;
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (selectedOnPage === visibleIds.length) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setRole("all");
  };

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="accounts" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Users}
        title="User Management"
        description="Who can sign in to the management system, and what their role lets them do."
        actions={
          <>
            <Button variant="outline" onClick={() => exportUsers(filtered.map((row) => row.user))}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            {onAdd ? (
              <Button onClick={onAdd} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Add user
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Account totals" min={180}>
        <StatCard compact label="All accounts" value={counts.all} caption="people with an account" onClick={() => setStatus("all")} />
        <StatCard compact label="Can sign in" value={counts.yes} caption={`${counts.all ? Math.round((counts.yes / counts.all) * 100) : 0}% of accounts`} onClick={() => setStatus("yes")} />
        <StatCard compact label="Not set up" value={counts.notSetUp} caption="no role given yet" onClick={() => setStatus("not-set-up")} />
        <StatCard compact label="Suspended" value={counts.blocked} caption="history is kept" onClick={() => setStatus("blocked")} />
      </StatCards>

      <DataCard label="Users">
        <FilterBar>
          <SearchField label="Search users" value={query} onChange={setQuery} placeholder="Search name or email" />
          <FilterSelect
            label="Role"
            value={role}
            onChange={setRole}
            options={[{ value: "all", label: "All" }, ...ROLES.map((r) => ({ value: r, label: roleLabel(r) }))]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            dashed={status === "all"}
            options={[
              { value: "all", label: "All" },
              { value: "yes", label: "Active" },
              { value: "not-set-up", label: "Not set up" },
              { value: "blocked", label: "Suspended" },
            ]}
          />
          <FilterSpacer />
          <BulkActions count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="outline" size="sm" disabled title="Change roles one account at a time, from the account">
              Change role
            </Button>
            <Button variant="outline" size="sm" disabled title="Suspend accounts one at a time, from the account">
              Suspend
            </Button>
          </BulkActions>
        </FilterBar>

        {!isLoaded ? (
          <LoadingState noun="accounts" bare />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={rows.length === 0 ? "No user accounts yet" : "No users match these filters"}
            description={rows.length === 0 ? "Add an account for each person who needs to sign in." : "Try another name, or show every role."}
            action={rows.length === 0 ? null : <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <Table minWidth={880} aria-label="User accounts">
            <TableHeader>
              <TableRow>
                <TableHead className="w-11 pl-0 text-center first:pl-0">
                  <Checkbox
                    aria-label="Select all users on this page"
                    checked={selectedOnPage > 0 && selectedOnPage === visibleIds.length}
                    indeterminate={selectedOnPage > 0 && selectedOnPage < visibleIds.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[120px]">Can sign in</TableHead>
                <TableHead className="w-[140px]">Last active</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.visible.map(({ user, signIn }) => {
                const landed = landedRow(change, "account", user.id);
                const checked = selected.has(user.id);
                const label = STATUS_LABEL[signIn.label] ?? signIn.label;
                return (
                  <TableRow key={landed.key} data-state={checked ? "selected" : undefined} className={landed.className}>
                    <TableCell className="pl-0 text-center first:pl-0">
                      <Checkbox aria-label={`Select ${user.name}`} checked={checked} onCheckedChange={() => toggle(user.id)} />
                    </TableCell>
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={user.name} />
                        <button type="button" data-slot="text-link" onClick={() => onManage(user.id)} className="truncate border-0 bg-transparent p-0 font-medium text-foreground hover:underline">
                          {user.name}
                        </button>
                        {user.isSuperAdmin ? <Badge variant="outline">Owner</Badge> : null}
                        {sameEmail(user.email, currentUserEmail) ? <Badge variant="outline">You</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-fg-3">{user.email}</TableCell>
                    <TableCell>{user.role ? roleLabel(user.role) : <span className="text-muted-fg">No role yet</span>}</TableCell>
                    <TableCell>
                      <StatusPill label={label} tone={signIn.label === "Yes" ? "green" : signIn.label === "Blocked" ? "red" : "amber"} />
                    </TableCell>
                    <TableCell className="text-muted-fg">{lastSeen.has(user.name) ? whenLabel(lastSeen.get(user.name)) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${user.name}`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-muted data-[popup-open]:bg-muted"
                        >
                          <DotsThree weight="bold" className="size-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[196px]">
                          <DropdownMenuItem onClick={() => onManage(user.id)}>
                            <PencilSimple aria-hidden="true" />
                            Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={!user.email} onClick={() => sendPasswordReset(user)}>
                            <Key aria-hidden="true" />
                            Reset password
                          </DropdownMenuItem>
                          {onChangeRole && !user.isSuperAdmin && !sameEmail(user.email, currentUserEmail) ? (
                            <DropdownMenuItem onClick={() => onChangeRole(user.id)}>
                              <UserGear aria-hidden="true" />
                              Change role
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => onManage(user.id)}>
                            <Prohibit aria-hidden="true" />
                            {user.status === "Blocked" ? "Review suspension" : "Suspend account"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <TablePagination
          summary={`${selected.size} of ${filtered.length} selected`}
          page={paged.page}
          pageCount={paged.pageCount}
          onPage={paged.onPage}
          pageSize={paged.pageSize}
          onPageSize={paged.onPageSize}
        />
      </DataCard>
    </Page>
  );
}
