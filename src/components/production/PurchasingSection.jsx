import { useState } from "react";

import { ClipboardText, PencilSimple, Plus, Trash, Truck, X } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mono } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import { EmptyState, Page, PageHeader, SearchField, StatCard, StatCards } from "../shared/page";
import { FlowStrip, LookBadge, MoreActions, ToggleChips } from "./parts";
import { MATERIAL_ORDER_LABEL } from "../../utils/copy";
import { pluralUnit, units } from "../../utils/production";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Production · Purchasing, drawn to the "7c · Production · Purchasing" board:
 *
 *   PageHeader (New supplier order) → four compact StatCards → "How a
 *   supplier order works" → FilterBar (search, Not received yet / All /
 *   Claims) → the supplier orders table (Order, Supplier, Material, Ordered,
 *   Agreed total, Expected, Status, Next step), or the open claims as cards.
 *
 * Receiving is each row's one next step. Editing, marking on the way,
 * cancelling and deleting sit behind the row's DotsThree.
 */
const LOOK = {
  Ordered: { className: "border-border-subtle bg-card text-fg-2", dot: "bg-muted-2" },
  "Delivery Scheduled": { className: "border-border bg-muted text-fg-2", dot: "bg-muted-fg" },
  "In Transit": { className: "border-border bg-muted text-ink", dot: "bg-inverse" },
  Arrived: { className: "border-success-bd bg-success-bg text-success-fg", dot: "bg-success" },
  Cancelled: { className: "border-border-subtle bg-card text-muted-fg", dot: "bg-border" },
};

const FLOW = [
  ["1. Order", "Supplier, material, quantity and agreed price. Nothing is added to stock yet."],
  ["2. Receive", "Count what was unloaded and what was damaged. Only usable units go into stock."],
  ["3. Settle", "A short, extra or damaged delivery opens a claim for a manager to settle."],
];

const WEEK = 7 * 86_400_000;

export default function PurchasingSection({ ws }) {
  const { materialOrders, mat, supplierName, worker, manager, canRemoveRecords, change, query, setQuery, now } = ws;
  const [filter, setFilter] = useState(ws.initialFilter === "claims" ? "claims" : ws.initialFilter === "all" ? "all" : "active");

  const waiting = materialOrders.filter((o) => !["Arrived", "Cancelled"].includes(o.status));
  const claims = materialOrders.filter((o) => o.claim_status === "Needs review");
  const arrivingThisWeek = waiting.filter((o) => {
    if (!o.expected_delivery_date) return false;
    const at = new Date(o.expected_delivery_date).getTime();
    return at - now < WEEK && at - now > -86_400_000;
  });
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const spent = materialOrders
    .filter((o) => o.status !== "Cancelled" && o.order_date && new Date(o.order_date).getTime() >= monthStart.getTime())
    .reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0);
  const month = monthStart.toLocaleDateString("en-US", { month: "long" });

  const needle = query.trim().toLowerCase();
  const rows = materialOrders
    .filter((o) => (filter === "all" ? true : filter === "claims" ? o.claim_status === "Needs review" : !["Arrived", "Cancelled"].includes(o.status)) || ws.justChanged("material-order", o.id))
    .filter((o) => `${mat(o.raw_material_id)?.name} ${supplierName(o.supplier_id)} ${o.id}`.toLowerCase().includes(needle))
    .slice()
    .reverse();

  const moreFor = (o) =>
    [
      manager && ["Ordered", "Delivery Scheduled"].includes(o.status) && {
        label: "Edit order",
        icon: <PencilSimple aria-hidden="true" />,
        onClick: () => ws.setDialog({ kind: "order", record: o }),
      },
      manager && o.status === "Delivery Scheduled" && {
        label: "Mark on the way",
        icon: <Truck aria-hidden="true" />,
        onClick: () => ws.showConfirm("order_status", o.id, "In Transit", "Mark as on the way?", `The supplier has sent order #${o.id}. No stock is added until it is received and counted.`),
      },
      manager && o.claim_status === "Needs review" && {
        label: "Record settlement",
        icon: <ClipboardText aria-hidden="true" />,
        onClick: () => ws.setDialog({ kind: "claim", record: o }),
      },
      manager && ["Ordered", "Delivery Scheduled", "In Transit"].includes(o.status) && {
        label: "Cancel order",
        icon: <X aria-hidden="true" />,
        danger: true,
        separatorBefore: true,
        onClick: () => ws.askWhy("cancel_supplier_order", o.id, {
          title: "Cancel this supplier order?",
          description: `Order #${o.id} will be marked as cancelled and can no longer be received. Stock does not change, and the order stays in the history.`,
          verb: "Cancel order", question: "Why is it being cancelled?",
        }),
      },
      canRemoveRecords && o.status !== "Arrived" && {
        label: "Delete order",
        icon: <Trash aria-hidden="true" />,
        danger: true,
        separatorBefore: !(manager && ["Ordered", "Delivery Scheduled", "In Transit"].includes(o.status)),
        onClick: () => ws.askWhy("delete_supplier_order", o.id, {
          title: `Delete supplier order #${o.id}?`,
          description: "For an order entered by mistake. Nothing was received, so no stock changes. It is removed from Purchasing for good; the activity log keeps a line saying who deleted it and why.",
          verb: "Delete order", question: "Why is it being deleted?",
        }),
      },
    ].filter(Boolean);

  return (
    <Page>
      <PageHeader
        icon={ClipboardText}
        title="Purchasing"
        description="Raw materials ordered from suppliers. Stock is added only when a delivery is received and counted."
        actions={
          manager ? (
            <Button onClick={() => ws.setDialog({ kind: "order" })} aria-haspopup="dialog">
              <Plus aria-hidden="true" />
              New supplier order
            </Button>
          ) : null
        }
      />

      <StatCards label="Purchasing totals" min={180}>
        <StatCard compact label="Waiting to arrive" value={waiting.length} caption={waiting.length === 1 ? "order" : "orders"} onClick={() => setFilter("active")} />
        <StatCard compact label="Arriving this week" value={arrivingThisWeek.length} caption={arrivingThisWeek.length === 1 ? "order" : "orders"} />
        <StatCard compact label="Open claims" value={claims.length} caption={claims.length === 1 ? "claim" : "claims"} onClick={() => setFilter("claims")} />
        <StatCard compact label={`Spent in ${month}`} value={formatPeso(spent)} caption="agreed totals" />
      </StatCards>

      <FlowStrip label="How a supplier order works" steps={FLOW} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search supplier orders" value={query} onChange={setQuery} placeholder="Search material, supplier or order" />
        <ToggleChips
          label="Show"
          value={filter}
          onChange={setFilter}
          chips={[
            { value: "active", label: "Not received yet", count: waiting.length },
            { value: "all", label: "All orders", count: materialOrders.length },
            { value: "claims", label: "Claims", count: claims.length },
          ]}
        />
      </div>

      {filter === "claims" ? (
        <section aria-label="Supplier claims" className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card shadow-xs">
              <EmptyState icon={ClipboardText} title="No open claims" description="A delivery that arrives short, extra or damaged opens one here." />
            </div>
          ) : (
            rows.map((o) => {
              const unit = mat(o.raw_material_id)?.unit;
              const issues = [
                o.quantity_ordered > o.quantity_arrived ? `${o.quantity_ordered - o.quantity_arrived} short` : null,
                o.quantity_arrived > o.quantity_ordered ? `${o.quantity_arrived - o.quantity_ordered} extra` : null,
                o.quantity_lost_transit > 0 ? `${o.quantity_lost_transit} damaged in transit` : null,
              ].filter(Boolean).join(" · ");
              return (
                <article key={o.id} className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono>#{o.id}</Mono>
                    <h2 className="m-0 flex-1 text-sm font-semibold">{issues || "Delivery does not match the order"}</h2>
                    <Badge variant={o.claim_status === "Resolved" ? "success" : "warning"} dot>
                      {o.claim_status === "Resolved" ? "Settled" : "Waiting for settlement"}
                    </Badge>
                  </div>
                  <p className="m-0 text-13 text-fg-2">
                    {supplierName(o.supplier_id)} delivered {units(o.quantity_arrived, unit)} of {mat(o.raw_material_id)?.name}
                    {o.actual_delivery_date ? ` on ${formatShortDate(o.actual_delivery_date)}` : ""}. {worker(o.received_by_staff_id)} counted {o.quantity_usable} usable
                    {o.quantity_lost_transit ? ` and ${o.quantity_lost_transit} damaged` : ""}.{o.transit_loss_reason ? ` ${o.transit_loss_reason}.` : ""} {o.quantity_usable} went into stock.
                  </p>
                  <dl className="m-0 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-13">
                    <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Ordered</dt><dd className="m-0 font-medium">{units(o.quantity_ordered, unit)}</dd></div>
                    <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Usable</dt><dd className="m-0 font-medium">{units(o.quantity_usable, unit)}</dd></div>
                    <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Value at stake</dt><dd className="m-0 font-medium">{formatPeso(Math.max(0, o.quantity_ordered - o.quantity_usable) * (Number(o.unit_price) || 0))}</dd></div>
                  </dl>
                  {manager ? (
                    <div>
                      <Button variant="outline" size="sm" onClick={() => ws.setDialog({ kind: "claim", record: o })}>Record settlement</Button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section aria-label="Supplier orders" className="rounded-lg border border-border bg-card shadow-xs">
          {rows.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={filter === "active" ? "Nothing is waiting to arrive" : "No supplier orders yet"}
              description={manager ? "Record what you ordered from a supplier. It waits here until somebody receives and counts the delivery." : "When a manager orders materials from a supplier, the order waits here until somebody receives and counts it."}
              action={query ? <Button variant="outline" onClick={() => setQuery("")}>Clear the search</Button> : null}
            />
          ) : (
            <Table minWidth={980} aria-label="Supplier orders">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-[120px]">Ordered</TableHead>
                  <TableHead className="w-[120px] text-right">Agreed total</TableHead>
                  <TableHead className="w-[110px]">Expected</TableHead>
                  <TableHead className="w-[190px]">Status</TableHead>
                  <TableHead className="w-[140px]"><span className="sr-only">Next step</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const unit = mat(o.raw_material_id)?.unit;
                  const landed = landedRow(change, "material-order", o.id);
                  return (
                    <TableRow key={landed.key} className={landed.className}>
                      <TableCell><Mono className="text-fg-2">#{o.id}</Mono></TableCell>
                      <TableCell className="max-w-[200px] truncate">{supplierName(o.supplier_id)}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{mat(o.raw_material_id)?.name}</TableCell>
                      <TableCell>{o.quantity_ordered} {pluralUnit(unit, o.quantity_ordered)}</TableCell>
                      <TableCell className="text-right">
                        {formatPeso(o.total_cost)}
                        <span className="block text-xs text-muted-fg">{supplierPaymentLabel(o)}</span>
                      </TableCell>
                      <TableCell className="text-muted-fg">
                        {o.status === "Arrived" ? formatShortDate(o.actual_delivery_date) : o.expected_delivery_date ? formatShortDate(o.expected_delivery_date) : "Not set"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <LookBadge look={{ label: MATERIAL_ORDER_LABEL[o.status], ...(LOOK[o.status] ?? LOOK.Ordered) }} />
                          {o.claim_status === "Needs review" ? <Badge variant="warning">Claim</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-1">
                          {!["Arrived", "Cancelled"].includes(o.status) ? (
                            <Button variant="outline" size="sm" aria-label="Receive delivery" onClick={() => ws.setDialog({ kind: "receive", record: o })}>
                              Receive
                            </Button>
                          ) : null}
                          <MoreActions label={`More for order ${o.id}`} items={moreFor(o)} />
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      )}

    </Page>
  );
}

/**
 * How a supplier order is paid and whether it has been: by card when it was
 * placed, or cash on delivery once the goods arrive (the database stamps
 * paid_at either way -- see the 2026-10-31 migration).
 */
function supplierPaymentLabel(order) {
  const how = order.payment_method === 'card' ? 'Card' : 'COD';
  if (order.status === 'Cancelled') return order.paid_at ? `${how} · paid, order cancelled` : `${how} · not paid`;
  return order.paid_at ? `${how} · paid` : `${how} · pay on arrival`;
}
