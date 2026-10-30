import { useState } from "react";

import { FloppyDisk, Lock, Plus, Shield } from "../icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Callout from "../shared/Callout";
import { Avatar } from "../shared/Chip";
import { Page, PageHeader } from "../shared/page";
import { cn } from "@/lib/utils";
import { can, canAccess } from "../../utils/permissions";
import { ROLE_BLURB, roleLabel } from "../../utils/copy";
import { ROLES } from "../../utils/staffData";

/**
 * Settings · Roles and permissions, drawn to the "9 · Settings · Roles and
 * permissions" board: the roles down the left, and the chosen role's
 * See / Add / Change / Remove grid.
 *
 * READ-ONLY. What each role may do is decided by utils/permissions.js and by
 * the database's own rules, so the grid is worked out from those and every
 * box is disabled. Add role and Save are disabled too: there is nowhere to
 * store a role or a change to one.
 */
const AREAS = [
  {
    key: "orders",
    area: "Orders and customers",
    hint: "Orders, customer records",
    test: (r) => [canAccess(r, "orders"), canAccess(r, "order-form"), can(r, "handleMoney") || can(r, "editCustomers"), can(r, "removeRecords")],
  },
  {
    key: "inventory",
    area: "Products and stock",
    hint: "Prices, stock counts, write-offs",
    test: (r) => [canAccess(r, "products"), can(r, "manageCatalogue"), can(r, "correctStock") || can(r, "recordDamage"), can(r, "removeRecords")],
  },
  {
    key: "materials",
    area: "Raw materials and suppliers",
    hint: "Supplier orders and claims",
    test: (r) => [canAccess(r, "raw-materials"), can(r, "manageSuppliers"), can(r, "manageSuppliers"), can(r, "removeRecords")],
  },
  {
    key: "production",
    area: "Production",
    hint: "Batches and quality checks",
    test: (r) => [canAccess(r, "production"), can(r, "makeBatches"), can(r, "correctBatches"), can(r, "removeRecords")],
  },
  {
    key: "deliveries",
    area: "Deliveries",
    hint: "Drivers, runs, what went out",
    test: (r) => [canAccess(r, "deliveries"), canAccess(r, "order-form"), canAccess(r, "deliveries"), false],
  },
  {
    key: "people",
    area: "Staff and accounts",
    hint: "Directory and sign-in accounts",
    test: (r) => [can(r, "manageStaff"), can(r, "manageStaff"), can(r, "manageStaff"), can(r, "manageStaff")],
  },
  {
    key: "reports",
    area: "Reports",
    hint: "The production report",
    test: (r) => [can(r, "viewReports"), false, false, false],
  },
  {
    key: "settings",
    area: "Settings",
    hint: "Business details and these permissions",
    test: (r) => [canAccess(r, "settings-roles"), false, false, false],
  },
];
const VERBS = ["See", "Add", "Change", "Remove"];

export default function SettingsRolesPage({ staff = [] }) {
  const [picked, setPicked] = useState("Sales Staff");
  const index = ROLES.indexOf(picked);
  const people = staff.filter((person) => person.role === picked);
  const locked = picked === "Admin";

  return (
    <Page>
      <PageHeader
        icon={Shield}
        title="Roles and permissions"
        description="What each role can see and change. Everyone with that role gets the change on their next page load."
        actions={
          <>
            <Button variant="outline" disabled>
              <Plus aria-hidden="true" />
              Add role
            </Button>
            <Button disabled>
              <FloppyDisk aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      />

      <Callout tone="neutral" icon={<Lock />} title="Shown read-only">
        Roles and what they allow are set in the system itself, not stored as settings, so they cannot be edited here. To change what one person does, change their role in User Management.
      </Callout>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <nav aria-label="Roles" className="roles-nav relative w-full rounded-lg border border-border bg-card p-1 shadow-xs lg:w-[240px] lg:shrink-0">
          <span className="roles-ind" aria-hidden="true" style={{ transform: `translateY(${index * 52}px)` }} />
          {ROLES.map((role) => {
            const on = role === picked;
            const count = staff.filter((person) => person.role === role).length;
            return (
              <button
                key={role}
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => setPicked(role)}
                className={cn("relative z-[1] flex h-[52px] w-full items-center gap-2 rounded-md border-0 px-3 text-left", on ? "text-on-primary" : "text-foreground hover:bg-surface-2")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{roleLabel(role)}</span>
                  <span className={cn("block text-xs", on ? "text-on-primary opacity-80" : "text-muted-fg")}>
                    {count} {count === 1 ? "person" : "people"}
                  </span>
                </span>
                {role === "Admin" ? <Lock className="size-3.5" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </nav>

        <section aria-labelledby="sr-title" className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
            <div className="min-w-0">
              <h2 id="sr-title" className="m-0 text-sm font-semibold">{roleLabel(picked)}</h2>
              <p className="m-0 text-13 text-muted-fg">{ROLE_BLURB[picked]}</p>
            </div>
            <span className="flex -space-x-1.5">
              {people.slice(0, 5).map((person) => (
                <span key={person.id} title={person.name} className="rounded-full ring-2 ring-card">
                  <Avatar name={person.name} />
                </span>
              ))}
            </span>
          </div>
          {locked ? (
            <p className="m-0 flex items-center gap-2 border-t border-row-divider px-4 py-2.5 text-13 text-muted-fg">
              <Lock className="size-4" aria-hidden="true" />
              Admin can always do everything, so nobody can lock the business out of its own system.
            </p>
          ) : null}
          <div className="border-t border-border">
            <Table minWidth={560} aria-label={`Permissions for ${roleLabel(picked)}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  {VERBS.map((verb) => <TableHead key={verb} className="w-[90px] text-center">{verb}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {AREAS.map((row) => {
                  const cells = row.test(picked);
                  return (
                    <TableRow key={row.key} className="h-11">
                      <TableCell>
                        <div className="font-medium">{row.area}</div>
                        <div className="text-xs text-muted-fg">{row.hint}</div>
                      </TableCell>
                      {cells.map((on, i) => (
                        <TableCell key={VERBS[i]} className="text-center">
                          <Checkbox disabled checked={Boolean(on)} aria-label={`${roleLabel(picked)} can ${VERBS[i].toLowerCase()} ${row.area.toLowerCase()}`} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </Page>
  );
}
