import { useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import { ArrowRight, CaretRight, ClipboardText, Factory, Plus, X } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { landedRow } from "../shared/landing";
import { EmptyState, Page, PageHeader, SearchField, StatCard, StatCards, TextLink } from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import { ToggleChips } from "../production/parts";
import { matches } from "../../utils/search";
import { MATERIAL_ORDER_LABEL } from "../../utils/copy";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Suppliers, drawn to the "15 · Suppliers" board:
 *
 *   PageHeader (Supplier orders, Add supplier) → four compact StatCards →
 *   search → the suppliers table (Supplier, Supplies, Lead time, On time,
 *   Last order) beside a details panel: three figures, contact facts, New
 *   supplier order / Edit details, what they supply and their orders.
 *
 * Lead time, on-time rate, damage and spend are worked out from the supplier
 * orders the app already records. "View supplier" opens the app's full
 * supplier screen, where a supplier can also be removed.
 */
const DAY = 86_400_000;

function supplierFacts(supplier, materialOrders, materials, year) {
  const orders = materialOrders.filter((o) => o.supplier_id === supplier.id);
  const arrived = orders.filter((o) => o.status === "Arrived" && o.actual_delivery_date);
  const timed = arrived.filter((o) => o.expected_delivery_date);
  const onTime = timed.length ? Math.round((timed.filter((o) => o.actual_delivery_date <= o.expected_delivery_date).length / timed.length) * 100) : null;
  const leads = arrived.filter((o) => o.order_date).map((o) => (new Date(o.actual_delivery_date) - new Date(o.order_date)) / DAY);
  const lead = leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null;
  const supplies = [...new Map(orders.map((o) => [o.raw_material_id, o])).values()].map((o) => ({
    id: o.raw_material_id,
    name: materials.find((m) => m.id === o.raw_material_id)?.name ?? "Material",
    price: [...orders].reverse().find((x) => x.raw_material_id === o.raw_material_id)?.unit_price,
  }));
  const last = orders.map((o) => o.order_date).filter(Boolean).sort().pop() ?? null;
  return {
    orders,
    onTime,
    lead,
    supplies,
    last,
    onTheWay: orders.filter((o) => !["Arrived", "Cancelled"].includes(o.status)).length,
    claim: orders.some((o) => o.claim_status === "Needs review"),
    damaged: arrived.filter((o) => o.quantity_lost_transit > 0).length,
    spent: orders.filter((o) => o.status !== "Cancelled" && String(o.order_date).startsWith(String(year))).reduce((s, o) => s + (Number(o.total_cost) || 0), 0),
  };
}

const leadLabel = (days) => (days === null ? "—" : days < 1 ? "Same day" : `${days} ${days === 1 ? "day" : "days"}`);

function DetailPanel({ supplier, facts, year, onClose, onEdit, onView, onOrder }) {
  return (
    <aside aria-labelledby="su-detail" className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs lg:w-[340px] lg:shrink-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="su-detail" className="m-0 truncate text-sm font-semibold">{supplier.name}</h2>
          <div className="text-13 text-muted-fg">{supplier.address || "No address"} · supplier since {formatShortDate(supplier.createdAt) || "—"}</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        {[
          ["On time", facts.onTime === null ? "—" : `${facts.onTime}%`],
          ["Arrived damaged", facts.damaged],
          [`Spent in ${year}`, formatPeso(facts.spent)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-2">
            <div className="text-xs text-muted-fg">{label}</div>
            <div className="text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-13">
        <dt className="text-muted-fg">Contact</dt><dd className="m-0">{supplier.contactPerson || "—"}</dd>
        <dt className="text-muted-fg">Phone</dt>
        <dd className="m-0">{supplier.contactNumber ? <a href={`tel:${String(supplier.contactNumber).replace(/[^\d+]/g, "")}`}>{supplier.contactNumber}</a> : "—"}</dd>
        <dt className="text-muted-fg">Email</dt><dd className="m-0 truncate">{supplier.email ? <a href={`mailto:${supplier.email}`}>{supplier.email}</a> : "—"}</dd>
        <dt className="text-muted-fg">Usually takes</dt><dd className="m-0">{leadLabel(facts.lead)}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        {onOrder ? <Button variant="outline" size="sm" onClick={onOrder}>New supplier order</Button> : null}
        {onEdit ? <Button variant="outline" size="sm" onClick={() => onEdit(supplier.id)}>Edit details</Button> : null}
      </div>
      <div>
        <h3 className="m-0 mb-1 text-13 font-semibold">What they supply</h3>
        <ul className="m-0 list-none p-0">
          {facts.supplies.length === 0 ? <li className="py-1 text-13 text-muted-fg">Nothing ordered from them yet.</li> : null}
          {facts.supplies.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 border-t border-row-divider py-1.5 text-13 first:border-t-0">
              <span className="truncate">{item.name}</span>
              <span className="text-muted-fg">{formatPeso(item.price)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="m-0 text-13 font-semibold">Orders</h3>
          <TextLink className="text-xs" onClick={() => onView(supplier.id)}>
            View supplier
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </TextLink>
        </div>
        <ul className="m-0 list-none p-0">
          {facts.orders.length === 0 ? <li className="py-1 text-13 text-muted-fg">No orders yet.</li> : null}
          {facts.orders.slice(-4).reverse().map((o) => (
            <li key={o.id} className="flex items-center gap-2 border-t border-row-divider py-1.5 text-13 first:border-t-0">
              <span className="font-mono text-xs text-fg-2">#{o.id}</span>
              <span className="flex-1 text-muted-fg">{formatShortDate(o.order_date)}</span>
              <Badge variant={o.status === "Arrived" ? "success" : "secondary"} dot>{MATERIAL_ORDER_LABEL[o.status]}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default function SupplierListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  suppliers = [],
  materialOrders = [],
  materials = [],
  onView,
  onAdd,
  onEdit,
  onOpenPurchasing,
  onGoToDashboard,
  change = null,
}) {
  const [query, setQuery] = useUrlState("query", "", "suppliers");
  const [show, setShow] = useUrlState("show", "in-use", "suppliers");
  const [selectedId, setSelectedId] = useState(null);
  const [now] = useState(() => Date.now());
  const year = new Date(now).getFullYear();

  const archivedCount = suppliers.filter((s) => s.status === "Archived").length;
  const rows = useMemo(
    () =>
      suppliers
        .filter((s) => (s.status === "Archived") === (show === "archived"))
        .map((supplier) => ({ supplier, facts: supplierFacts(supplier, materialOrders, materials, year) }))
        .filter(({ supplier, facts }) => matches(query, supplier.name, supplier.contactPerson, supplier.contactNumber, supplier.address, ...facts.supplies.map((s) => s.name)))
        .sort((a, b) => String(a.supplier.name).localeCompare(String(b.supplier.name))),
    [suppliers, materialOrders, materials, year, query, show]
  );
  const all = useMemo(() => suppliers.map((s) => supplierFacts(s, materialOrders, materials, year)), [suppliers, materialOrders, materials, year]);
  const selected = rows.find(({ supplier }) => supplier.id === selectedId) ?? null;

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="suppliers" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Factory}
        title="Suppliers"
        description="Where the workshop buys foam, paint and supplies, and how reliably they deliver."
        actions={
          <>
            {onOpenPurchasing ? (
              <Button variant="outline" onClick={onOpenPurchasing}>
                <ClipboardText aria-hidden="true" />
                Supplier orders
              </Button>
            ) : null}
            {onAdd ? (
              <Button onClick={onAdd} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Add supplier
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Supplier totals" min={180}>
        <StatCard compact label="Suppliers" value={suppliers.length - archivedCount} caption={archivedCount ? `${archivedCount} no longer used` : "in use"} />
        <StatCard compact label="Orders on the way" value={all.reduce((s, f) => s + f.onTheWay, 0)} caption="not received yet" />
        <StatCard compact label={`Spent in ${year}`} value={formatPeso(all.reduce((s, f) => s + f.spent, 0))} caption="agreed totals" />
        <StatCard compact label="Open claims" value={all.filter((f) => f.claim).length} caption="waiting to be settled" />
      </StatCards>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search suppliers" value={query} onChange={setQuery} placeholder="Search supplier or material" />
        {archivedCount > 0 ? (
          <ToggleChips
            label="Show"
            value={show}
            onChange={setShow}
            chips={[
              { value: "in-use", label: "In use", count: suppliers.length - archivedCount },
              { value: "archived", label: "No longer used", count: archivedCount },
            ]}
          />
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <section aria-label="Suppliers" className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card shadow-xs">
          {!isLoaded ? (
            <LoadingState noun="suppliers" bare />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Factory}
              title={suppliers.length === 0 ? "No suppliers yet" : "No suppliers match that"}
              description={suppliers.length === 0 ? "Add the businesses the workshop buys materials from." : "Try another name or material."}
              action={query ? <Button variant="outline" onClick={() => setQuery("")}>Clear the search</Button> : null}
            />
          ) : (
            <Table minWidth={720} aria-label="Suppliers">
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Supplies</TableHead>
                  <TableHead className="w-[100px]">Lead time</TableHead>
                  <TableHead className="w-[130px]">On time</TableHead>
                  <TableHead className="w-[140px]">Last order</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ supplier, facts }) => {
                  const landed = landedRow(change, "supplier", supplier.id);
                  return (
                    <TableRow key={landed.key} data-state={supplier.id === selectedId ? "selected" : undefined} className={`h-10 ${landed.className ?? ""}`}>
                      <TableCell>
                        <button type="button" data-slot="text-link" onClick={() => setSelectedId(supplier.id)} className="block max-w-[240px] truncate border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline">
                          {supplier.name}
                        </button>
                        <span className="block text-2xs leading-[14px] text-muted-fg">{supplier.contactPerson || supplier.address || "—"}</span>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-fg-2">{facts.supplies.map((s) => s.name).join(", ") || "—"}</TableCell>
                      <TableCell className="text-fg-2">{leadLabel(facts.lead)}</TableCell>
                      <TableCell>
                        {facts.onTime === null ? (
                          <span className="text-muted-fg">—</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="relative h-1 w-12 overflow-hidden rounded-sm bg-muted">
                              <span className="absolute inset-y-0 left-0 bg-muted-fg" style={{ width: `${facts.onTime}%` }} />
                            </span>
                            <span>{facts.onTime}%</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-fg">
                        {facts.last ? formatShortDate(facts.last) : "Never"}
                        {facts.claim ? <Badge variant="warning" className="ml-2">Claim</Badge> : null}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open ${supplier.name}`} onClick={() => setSelectedId(supplier.id)}>
                          <CaretRight aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
        {selected ? (
          <DetailPanel
            supplier={selected.supplier}
            facts={selected.facts}
            year={year}
            onClose={() => setSelectedId(null)}
            onEdit={onEdit}
            onView={onView}
            onOrder={onOpenPurchasing}
          />
        ) : null}
      </div>
    </Page>
  );
}
