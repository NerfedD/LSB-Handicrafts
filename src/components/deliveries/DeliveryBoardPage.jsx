import { useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import { ArrowRight, Kanban, List, Printer, Truck, UserPlus } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Avatar } from "../shared/Chip";
import Landed from "../shared/Landed";
import { landedRow } from "../shared/landing";
import { EmptyState, FilterSelect, Page, PageHeader, SearchField, StatCard, StatCards } from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import { cn } from "@/lib/utils";
import StageBadge from "./StageBadge";
import { STAGE_LOOK } from "./stageLook";
import { isBackorderDelivery } from "../../utils/orders";
import { matches } from "../../utils/search";
import { DELIVERY_STAGE } from "../../utils/constants";
import {
  areaOf,
  areasOf,
  board,
  customerFrom,
  dueLabel,
  dueTime,
  hasNoDriver,
  isDueThisWeek,
  isDueToday,
  isLate,
  matchesChip,
  nextStage,
} from "../../utils/deliveries";

/**
 * Deliveries, drawn to the "6 · Deliveries" board:
 *
 *   PageHeader (Print run sheet, Assign drivers) → four compact StatCards →
 *   FilterBar (search, Due, Driver, count, Table / Board) → the table, or the
 *   kanban board with one column per stage.
 *
 * Each row and card carries the next step ("Start making", "Mark ready",
 * "Send out", "Mark delivered"), which moves the delivery the way the detail
 * screen does: sending out opens the manifest dialog first.
 */
const DUE_OPTIONS = [
  { value: "any", label: "Any day" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "late", label: "Late" },
];

const shortDue = (delivery) => {
  const due = dueTime(delivery);
  if (due === null) return "No date";
  if (isDueToday(delivery)) return "Today";
  return new Date(due).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const lateDays = (delivery) => {
  const due = dueTime(delivery);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - due) / 86400000);
  return days;
};

export default function DeliveryBoardPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  deliveries = [],
  orders = [],
  staff = [],
  onOpen,
  onMoveForward,
  onAssignDrivers,
  onGoToDashboard,
  initialFilter,
  change = null,
}) {
  const [query, setQuery] = useUrlState("query", "", "deliveries");
  const [chip] = useUrlState("tab", initialFilter ?? "all", "deliveries");
  const [due, setDue] = useUrlState("due", "any", "deliveries");
  const [driver, setDriver] = useUrlState("driver", "any", "deliveries");
  const [area, setArea] = useUrlState("area", "any", "deliveries");
  const [view, setView] = useState("table");

  const areas = useMemo(() => areasOf(deliveries), [deliveries]);
  const drivers = useMemo(() => {
    const seen = new Map();
    for (const person of staff) if (person.name) seen.set(person.name.toLowerCase(), person.name);
    for (const delivery of deliveries) {
      const name = String(delivery.driver || "").trim();
      if (name) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [staff, deliveries]);

  const itemsOf = useMemo(() => {
    const byId = new Map(orders.map((order) => [order.id, order]));
    return (delivery) => {
      const manifest = delivery.itemsManifest ?? [];
      if (manifest.length) return manifest.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
      const order = byId.get(delivery.orderId);
      return order?.items?.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0) ?? null;
    };
  }, [orders]);

  const open = deliveries.filter((d) => d.status !== DELIVERY_STAGE.ARRIVED);
  const stats = useMemo(() => {
    const today = open.filter(isDueToday);
    const week = open.filter(isDueThisWeek);
    const late = open.filter(isLate);
    const noDriver = open.filter(hasNoDriver);
    return {
      today: today.length,
      onRoad: today.filter((d) => d.status === DELIVERY_STAGE.ON_THE_WAY).length,
      week: week.length,
      weekAreas: new Set(week.map(areaOf).filter(Boolean)).size,
      late: late.length,
      oldest: late.reduce((max, d) => Math.max(max, lateDays(d)), 0),
      noDriver: noDriver.length,
      readyNoDriver: noDriver.filter((d) => d.status === DELIVERY_STAGE.READY).length,
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      deliveries.filter((delivery) => {
        if (!matchesChip(delivery, chip)) return false;
        if (due === "today" && !isDueToday(delivery)) return false;
        if (due === "late" && !isLate(delivery)) return false;
        if (due === "week" && !isDueThisWeek(delivery)) return false;
        if (driver === "none" && !hasNoDriver(delivery)) return false;
        if (driver !== "any" && driver !== "none" && delivery.driver !== driver) return false;
        if (area !== "any" && areaOf(delivery) !== area) return false;
        return matches(query, delivery.product, delivery.location, `#${delivery.id}`, delivery.driver);
      }),
    [deliveries, chip, due, driver, area, query]
  );
  const columns = useMemo(() => board(filtered), [filtered]);

  const clearAll = () => {
    setDue("any");
    setDriver("any");
    setArea("any");
    setQuery("");
  };

  const nextButton = (delivery, compact = false) => {
    const next = nextStage(delivery);
    const verb = STAGE_LOOK[delivery.status]?.verb;
    if (!next || !verb || !onMoveForward) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={compact ? `${verb}, delivery ${delivery.id}` : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onMoveForward(delivery.id, next.value);
        }}
        className={compact ? "h-6 gap-1 px-2 text-xs" : undefined}
      >
        {verb}
        {compact ? <ArrowRight className="size-3" aria-hidden="true" /> : null}
      </Button>
    );
  };

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="deliveries" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Truck}
        title="Deliveries"
        description="Every order on its way out, from the workshop to the customer's door."
        actions={
          <>
            <Button variant="outline" disabled title="The run sheet is not printable yet">
              <Printer aria-hidden="true" />
              Print run sheet
            </Button>
            {onAssignDrivers ? (
              <Button onClick={onAssignDrivers} aria-haspopup="dialog">
                <UserPlus aria-hidden="true" />
                Assign drivers
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Delivery totals" min={180}>
        <StatCard compact label="Due today" value={stats.today} caption={`${stats.onRoad} already on the road`} onClick={() => setDue("today")} />
        <StatCard compact label="Due this week" value={stats.week} caption={`across ${stats.weekAreas} ${stats.weekAreas === 1 ? "area" : "areas"}`} onClick={() => setDue("week")} />
        <StatCard compact label="Late" value={stats.late} caption={stats.late ? `oldest ${stats.oldest} ${stats.oldest === 1 ? "day" : "days"}` : "none late"} onClick={() => setDue("late")} />
        <StatCard compact label="No driver yet" value={stats.noDriver} caption={`${stats.readyNoDriver} ${stats.readyNoDriver === 1 ? "is" : "are"} ready to go`} onClick={() => setDriver("none")} />
      </StatCards>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search deliveries" value={query} onChange={setQuery} placeholder="Search number, customer or area" />
        <FilterSelect label="Due" value={due} onChange={setDue} options={DUE_OPTIONS} />
        <FilterSelect
          label="Driver"
          value={driver}
          onChange={setDriver}
          options={[{ value: "any", label: "Anyone" }, { value: "none", label: "Nobody yet" }, ...drivers.map((name) => ({ value: name, label: name }))]}
        />
        {areas.length > 1 ? (
          <FilterSelect label="Area" value={area} onChange={setArea} options={[{ value: "any", label: "Everywhere" }, ...areas.map((name) => ({ value: name, label: name }))]} />
        ) : null}
        <span className="flex-[1_1_0] whitespace-nowrap text-13 text-muted-fg">
          {filtered.length} of {deliveries.length} deliveries
        </span>
        <ToggleGroup
          label="View"
          value={view}
          onValueChange={setView}
          options={[
            { value: "table", label: "Table", icon: <List aria-hidden="true" /> },
            { value: "board", label: "Board", icon: <Kanban aria-hidden="true" /> },
          ]}
        />
      </div>

      {!isLoaded ? (
        <LoadingState noun="deliveries" />
      ) : view === "table" ? (
        <section aria-label="Deliveries table" className="rounded-lg border border-border bg-card shadow-xs">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No deliveries match these filters"
              description="An empty list here is the filters, not a quiet day."
              action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <Table minWidth={980} aria-label="Deliveries">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Delivery</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="w-[170px]">Due</TableHead>
                  <TableHead className="w-[160px]">Driver</TableHead>
                  <TableHead className="w-[70px] text-right">Items</TableHead>
                  <TableHead className="w-[130px]">Stage</TableHead>
                  <TableHead className="w-[140px]"><span className="sr-only">Next step</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((delivery) => {
                  const landed = landedRow(change, "delivery", delivery.id);
                  const late = isLate(delivery);
                  const items = itemsOf(delivery);
                  return (
                    <TableRow key={landed.key} className={landed.className}>
                      <TableCell>
                        <button type="button" data-slot="text-link" onClick={() => onOpen(delivery.id)} className="border-0 bg-transparent p-0 font-medium text-primary-text hover:underline">
                          #{delivery.id}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">
                        {customerFrom(delivery) || "No customer named"}
                        {isBackorderDelivery(delivery) ? <Badge variant="outline" className="ml-2">Rest of an order</Badge> : null}
                      </TableCell>
                      <TableCell className="text-fg-2">{areaOf(delivery) || "—"}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span className={late ? "text-danger-fg" : undefined}>{shortDue(delivery)}</span>
                          {late ? <Badge variant="destructive">{dueLabel(delivery).replace(/^(\d+) (days?) late$/, "Late $1 $2")}</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasNoDriver(delivery) ? (
                          <span className="text-muted-fg">Nobody yet</span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Avatar name={delivery.driver} />
                            {delivery.driver}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{items ?? "—"}</TableCell>
                      <TableCell><StageBadge status={delivery.status} /></TableCell>
                      <TableCell className="text-right">{nextButton(delivery)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      ) : (
        <section aria-label="Deliveries board" className="overflow-x-auto pb-1">
          <div className="grid min-w-[1060px] grid-cols-5 gap-3">
            {columns.map((column) => {
              const look = STAGE_LOOK[column.value];
              return (
                <div
                  key={column.value}
                  role="region"
                  aria-label={`${look.label}, ${column.items.length}`}
                  className="flex min-h-[420px] flex-col gap-2 rounded-lg border border-border bg-column p-2"
                >
                  <div className="flex items-center gap-2 px-1 py-1">
                    <span aria-hidden="true" className={cn("size-2 rounded-full", look.dot)} />
                    <h2 className="m-0 flex-1 text-13 font-semibold">{look.label}</h2>
                    <span className="text-xs text-muted-fg">{column.items.length}</span>
                  </div>
                  {column.items.map((delivery) => {
                    const late = isLate(delivery);
                    const items = itemsOf(delivery);
                    return (
                      <article
                        key={delivery.id}
                        className="lsb-card-in relative flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-13 shadow-xs"
                      >
                        <Landed change={change} kind="delivery" id={delivery.id} />
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" data-slot="text-link" onClick={() => onOpen(delivery.id)} className="border-0 bg-transparent p-0 font-medium text-primary-text hover:underline">
                            #{delivery.id}
                          </button>
                          {late ? <Badge variant="destructive">{dueLabel(delivery).replace(/^(\d+) (days?) late$/, "Late $1 $2")}</Badge> : null}
                        </div>
                        <div>
                          <h3 className="m-0 truncate text-13 font-medium">{customerFrom(delivery) || "No customer named"}</h3>
                          <p className="m-0 text-xs text-muted-fg">
                            {[areaOf(delivery), shortDue(delivery), items !== null ? `${items} items` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {hasNoDriver(delivery) ? (
                            <span className="text-xs text-muted-fg">No driver yet</span>
                          ) : (
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
                              <Avatar name={delivery.driver} className="size-5 text-[9px]" />
                              <span className="truncate">{delivery.driver}</span>
                            </span>
                          )}
                          {nextButton(delivery, true)}
                        </div>
                      </article>
                    );
                  })}
                  {column.items.length === 0 ? <p className="m-0 py-6 text-center text-xs text-muted-fg">Nothing here right now</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}
