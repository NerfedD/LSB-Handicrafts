import { useEffect, useMemo, useState } from "react";

import { BookUser, History, Settings, UserPlus, Users } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "../shared/Chip";
import { FilterBar, RecordCard, StickyCta } from "../shared/ListScreen";
import { FilterChips, Pager, SearchField } from "../shared/filters";
import { EmptyState, ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill, { InlineBadge } from "../shared/StatusPill";
import usePaged from "../../hooks/usePaged";
import { matches } from "../../utils/search";
import { roleLabel, signInState } from "../../utils/copy";

/**
 * Staff & accounts — screen 2o.
 *
 * "CAN SIGN IN", NOT "STATUS". This is the column that justifies the screen.
 * An administrator opening it is answering one of two questions — can this
 * person get in, and what are they allowed to do — and "Status: Active" answers
 * neither. Three plain answers do:
 *
 *   Yes           green, with a check
 *   Blocked       red, with a cross
 *   Not set up    amber, with a clock — the password works, but nobody has
 *                 said what the account does, so it still cannot get in
 *
 * That third state existed all along and had no name. Somebody with a working
 * password and no role was shown "Active", tried to sign in, and was bounced
 * with no explanation on either screen.
 *
 * "MANAGE", NOT A KEBAB. One 44px button per row that says where it goes.
 * Every destructive action lives on the account's own screen, inside its own
 * outlined block — never as a red icon in this table.
 */

export default function StaffAccountsPage({
  users = [],
  isLoaded = true,
  loadError = null,
  onRetry,
  onGoToDashboard,
  currentUserEmail,
  onManage,
  onAdd,
  onOpenDirectory,
  onOpenActivity,
  onContext,
  initialFilter,
}) {
  const [query, setQuery] = useState("");
  // Seeded from the dashboard. An attention row's button names a verb and
  // lands here with the matching chip already on, so the sentence somebody
  // read and the list they arrive at agree. It stays an ordinary chip
  // afterwards -- clearable, and not a mode.
  const [chip, setChip] = useState(initialFilter ?? "all");

  const rows = useMemo(
    () => users.map((user) => ({ user, signIn: signInState(user) })),
    [users]
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      yes: rows.filter((r) => r.signIn.label === "Yes").length,
      blocked: rows.filter((r) => r.signIn.label === "Blocked").length,
      notSetUp: rows.filter((r) => r.signIn.label === "Not set up").length,
    }),
    [rows]
  );

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(
      `${counts.all} people with accounts · ${counts.yes} can sign in`
    );
  }, [counts.all, counts.yes, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const wanted = { yes: "Yes", blocked: "Blocked", "not-set-up": "Not set up" }[chip];
    return rows
      .filter(({ user, signIn }) => {
        if (wanted && signIn.label !== wanted) return false;
        return matches(query, user.name, user.email, user.username, user.role);
      })
      .sort((a, b) => String(a.user.name).localeCompare(String(b.user.name)));
  }, [rows, chip, query]);

  const paged = usePaged(filtered);

  const chips = [
    { value: "all", label: "Everyone", count: counts.all },
    { value: "yes", label: "Can sign in", count: counts.yes, tone: "green" },
    { value: "blocked", label: "Blocked", count: counts.blocked, tone: "red" },
    { value: "not-set-up", label: "Not set up", count: counts.notSetUp, tone: "amber" },
  ];

  // Ahead of everything else, like the other four list screens: a failed read
  // has nothing to filter, and offering a search box over it is a dead end.
  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="accounts" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or email"
          id="staff-search"
        />
        {/* The directory and the activity log have no nav entry of their own —
            they belong to this section, and this is where somebody looking for
            "who do I call" or "who changed that price" would come first. */}
        <Button variant="outline" size="field" onClick={onOpenDirectory}>
          <BookUser className="h-4.5 w-4.5" />
          Who to call for what
        </Button>
        <Button variant="outline" size="field" onClick={onOpenActivity}>
          <History className="h-4.5 w-4.5" />
          What happened recently
        </Button>
      </FilterBar>

      <FilterChips chips={chips} value={chip} onChange={setChip} label="Show which accounts" />

      {!isLoaded ? (
        <LoadingState noun="accounts" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No staff accounts yet"
          description="Add an account for each person who needs to sign in, and say what they do."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
          actionLabel="Add a staff account"
          onAction={onAdd}
        />
      ) : (
        <>
          <Card className="hidden tab:block">
            <Table minWidth={820}>
              <TableCaption>Everyone with an account, and whether they can sign in</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Person</TableHead>
                  <TableHead className="w-56">What they do</TableHead>
                  <TableHead className="w-48">Can sign in</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map(({ user, signIn }) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3.5">
                        <Avatar name={user.name} size="md" />
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[16.5px] font-bold">{user.name}</span>
                            {user.isSuperAdmin && <InlineBadge label="Owner" tone="cobalt" />}
                            {user.email === currentUserEmail && (
                              <InlineBadge label="You" tone="purple" />
                            )}
                          </p>
                          <p className="truncate pt-0.5 text-[14px] text-muted">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-[15.5px]">
                      {user.role ? (
                        roleLabel(user.role)
                      ) : (
                        <span className="text-muted-2">Nothing set yet</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <StatusPill
                        label={signIn.label}
                        tone={signIn.tone}
                        mark={signIn.icon}
                        size="sm"
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => onManage(user.id)}>
                          <Settings className="h-4.5 w-4.5" />
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <CardFooter>
              <Pager {...paged} noun="accounts" className="w-full" />
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-3 tab:hidden">
            {paged.visible.map(({ user, signIn }) => (
              <RecordCard key={user.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[16.5px] font-bold">{user.name}</p>
                    <p className="truncate text-[14px] text-muted">{user.email}</p>
                  </div>
                </div>
                <p className="pt-3 text-[15.5px]">{roleLabel(user.role)}</p>
                <div className="flex items-center justify-between gap-3 pt-3.5">
                  <StatusPill
                    label={signIn.label}
                    tone={signIn.tone}
                    mark={signIn.icon}
                    size="sm"
                  />
                  <Button variant="outline" onClick={() => onManage(user.id)}>
                    <Settings className="h-5 w-5" />
                    Manage
                  </Button>
                </div>
              </RecordCard>
            ))}

            <Card className="p-4">
              <Pager {...paged} noun="accounts" />
            </Card>
          </div>

          <StickyCta>
            <Button variant="cobalt" size="xl" block onClick={onAdd}>
              <UserPlus className="h-5.5 w-5.5" />
              Add a staff account
            </Button>
          </StickyCta>
        </>
      )}
    </div>
  );
}
