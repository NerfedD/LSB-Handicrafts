import { useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import { DotsThree, DownloadSimple, Envelope, IdentificationCard, List, Phone, Plus, SquaresFour } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Avatar } from "../shared/Chip";
import { EmptyState, FilterSelect, Page, PageHeader, SearchField } from "../shared/page";
import { LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { downloadCsv } from "@/lib/csv";
import { matches } from "../../utils/search";
import { roleLabel } from "../../utils/copy";

/**
 * The Staff Directory, drawn to the "4 · Staff Directory" board:
 *
 *   PageHeader (Export, Add staff member) → FilterBar (search, Department,
 *   count, Table / Cards) → the cards grid or the table.
 *
 * Departments follow from each person's role. The app keeps no shift or
 * start-date records, so where the board shows "Today" and "Since" the
 * directory shows the phone number, which is what people come here for.
 */
const DEPARTMENT = {
  Admin: "Office",
  Manager: "Office",
  "Sales Staff": "Sales",
  "Production Staff": "Production",
  "Delivery Staff": "Delivery",
};
const DEPARTMENTS = ["Production", "Sales", "Delivery", "Office"];
const departmentOf = (person) => DEPARTMENT[person.role] ?? "Not set";

export default function StaffDirectoryPage({ staff = [], isLoaded = true, onAdd, onOpen }) {
  const [query, setQuery] = useUrlState("query", "", "directory");
  const [dept, setDept] = useState("all");
  const [view, setView] = useState("cards");

  const people = useMemo(
    () =>
      staff
        .filter((person) => (dept === "all" || departmentOf(person) === dept) && matches(query, person.name, person.role, person.contactNumber, person.email))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [staff, query, dept]
  );

  const exportDirectory = () =>
    downloadCsv(
      "lsb-staff-directory.csv",
      [
        { label: "Name", value: (p) => p.name },
        { label: "Position", value: (p) => roleLabel(p.role) },
        { label: "Department", value: departmentOf },
        { label: "Phone", value: (p) => p.contactNumber },
        { label: "Email", value: (p) => p.email },
      ],
      people
    );

  const menu = (person) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`More for ${person.name}`}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-muted data-[popup-open]:bg-muted"
      >
        <DotsThree weight="bold" className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {person.contactNumber ? (
          <DropdownMenuItem render={<a href={`tel:${String(person.contactNumber).replace(/[^\d+]/g, "")}`} />}>
            <Phone aria-hidden="true" />
            Call
          </DropdownMenuItem>
        ) : null}
        {person.email ? (
          <DropdownMenuItem render={<a href={`mailto:${person.email}`} />}>
            <Envelope aria-hidden="true" />
            Email
          </DropdownMenuItem>
        ) : null}
        {onOpen ? (
          <DropdownMenuItem onClick={() => onOpen(person.id)}>
            <IdentificationCard aria-hidden="true" />
            View profile
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Page>
      <PageHeader
        icon={IdentificationCard}
        title="Staff Directory"
        description="Everyone at the workshop, across production, sales, delivery and the office."
        actions={
          <>
            <Button variant="outline" onClick={exportDirectory}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            {onAdd ? (
              <Button onClick={onAdd} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Add staff member
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search staff" value={query} onChange={setQuery} placeholder="Search name or position" />
        <FilterSelect
          label="Department"
          value={dept}
          onChange={setDept}
          options={[{ value: "all", label: "All" }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
        />
        <span className="flex-[1_1_0] whitespace-nowrap text-13 text-muted-fg">
          {people.length} of {staff.length} {staff.length === 1 ? "person" : "people"}
        </span>
        <ToggleGroup
          label="View"
          value={view}
          onValueChange={setView}
          options={[
            { value: "table", label: "Table", icon: <List aria-hidden="true" /> },
            { value: "cards", label: "Cards", icon: <SquaresFour aria-hidden="true" /> },
          ]}
        />
      </div>

      {!isLoaded ? (
        <LoadingState noun="people" />
      ) : people.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-xs">
          <EmptyState
            icon={IdentificationCard}
            title={staff.length === 0 ? "Nobody on the team yet" : "Nobody matches these filters"}
            description={staff.length === 0 ? "Once staff accounts exist, this is where anyone can find who to call for what." : "Try another name, or show every department."}
            action={staff.length ? <Button variant="outline" onClick={() => { setQuery(""); setDept("all"); }}>Clear filters</Button> : null}
          />
        </div>
      ) : view === "cards" ? (
        <section aria-label="Staff cards" className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {people.map((person) => (
            <article key={person.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} size="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 truncate text-sm font-semibold">{person.name}</h3>
                  <p className="m-0 truncate text-13 text-muted-fg">{person.role ? roleLabel(person.role) : "No role yet"}</p>
                </div>
                {menu(person)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{departmentOf(person)}</Badge>
                {person.status === "Blocked" ? <StatusPill label="Suspended" tone="red" /> : null}
              </div>
              <div className="flex flex-col gap-1.5 text-13 text-fg-3">
                <span className="flex min-w-0 items-center gap-2">
                  <Envelope className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{person.email || "No email"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {person.contactNumber ? (
                    <a href={`tel:${String(person.contactNumber).replace(/[^\d+]/g, "")}`} className="text-fg-3 no-underline hover:text-foreground">
                      {person.contactNumber}
                    </a>
                  ) : (
                    "No phone number"
                  )}
                </span>
              </div>
              {onOpen ? (
                <Button variant="outline" size="sm" block onClick={() => onOpen(person.id)}>
                  View profile
                </Button>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section aria-label="Staff table" className="rounded-lg border border-border bg-card shadow-xs">
          <Table minWidth={860} aria-label="Staff">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[150px]">Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={person.name} />
                      <span className="truncate font-medium">{person.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>{person.role ? roleLabel(person.role) : "No role yet"}</TableCell>
                  <TableCell><Badge variant="outline">{departmentOf(person)}</Badge></TableCell>
                  <TableCell className="text-fg-3">{person.contactNumber || "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-fg-3">{person.email}</TableCell>
                  <TableCell className="text-center">{menu(person)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </Page>
  );
}
