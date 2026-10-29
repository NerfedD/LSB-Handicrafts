import { useMemo, useState } from "react";

import { CheckCircle, Info, Money, Package, PencilSimple, Printer, Repeat, Tag, Truck, XCircle } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Callout, { DangerBlock } from "../shared/Callout";
import ConfirmDialog from "../shared/ConfirmDialog";
import { NotFoundState } from "../shared/PageStates";
import { Page, PageHeader, TextLink } from "../shared/page";
import StatusPill from "../shared/StatusPill";
import StageBadge from "../deliveries/StageBadge";
import { STAGE_LOOK } from "../deliveries/stageLook";
import OrderSlip from "./OrderSlip";
import { cn } from "@/lib/utils";
import { DELIVERY_STAGE, ORDER_STATUS } from "../../utils/constants";
import {
  DELIVERY_STAGES,
  dispositionLabel,
  orderLabel,
  orderTone,
  priceReasonLabel,
  refundMethodLabel,
  refundReasonLabel,
  replacementReasonLabel,
} from "../../utils/copy";
import { normalizeItems } from "../../utils/orderItems";
import {
  backorderLines,
  daysWaiting,
  deliveryForOrder,
  deliveriesForOrder,
  hasBackorder,
  isBackorderDelivery,
  lastPriceAdjustment,
  orderTotals,
  returnHistory,
} from "../../utils/orders";
import { dueLabel, isLate } from "../../utils/deliveries";
import { committedOf, outstandingOf, stockLines } from "../../utils/stockLedger";
import { timeLabel } from "../../utils/activityLog";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One order, drawn to the "17 · Order detail and edit" board:
 *
 *   Back to Orders → the header (Order #, the delivery stage and order status,
 *   customer · taken · deliver; Print slip, Cancel order, Edit order) → Items
 *   with the totals → Delivery (the five stages, date, address, driver) →
 *   Payments, beside Customer and History.
 *
 * The app does not record payments, so Payments holds the money the app does
 * record (refunds, replacements and price fixes) with its actions, and
 * Record payment is disabled. Editing opens the order editor (the board's
 * edit mode).
 */
function Panel({ id, title, action, children, className }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-lg border border-border bg-card shadow-xs", className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3.5">
        <h2 id={id} className="m-0 text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Totals({ order, totals }) {
  const rows = [
    ["Items", formatPeso(totals.items)],
    ["Delivery", totals.delivery > 0 ? formatPeso(totals.delivery) : "Free"],
    ...(totals.discount > 0
      ? [[`${order.promotion?.label || "Loyalty reward"}${order.promotion?.percent ? ` (${order.promotion.percent}%)` : ""}`, `−${formatPeso(totals.discount)}`]]
      : []),
  ];
  return (
    <dl className="m-0 grid grid-cols-[1fr_auto] justify-items-end gap-x-6 gap-y-1.5 px-4 py-3 text-13">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-fg">{label}</dt>
          <dd className="m-0">{value}</dd>
        </div>
      ))}
      <dt className="font-medium">Order total</dt>
      <dd className="m-0 text-base font-semibold">{formatPeso(totals.total)}</dd>
      {totals.refunded > 0 ? (
        <>
          <dt className="text-muted-fg">Given back</dt>
          <dd className="m-0 text-danger-fg">−{formatPeso(totals.refunded)}</dd>
          <dt className="font-medium">What they still owe</dt>
          <dd className="m-0 font-semibold">{formatPeso(totals.net)}</dd>
        </>
      ) : null}
    </dl>
  );
}

export default function OrderDetailPage({
  order,
  customer,
  deliveries = [],
  canHandleMoney = false,
  canViewCustomers = true,
  onBack,
  onMarkDone,
  onAssignDriver,
  onPrint,
  onRefund,
  onReplace,
  onAdjustPrice,
  onReopen,
  canEdit = false,
  editBlocker = null,
  onEdit,
  onCancelOrder,
  onOpenDelivery,
  onOpenCustomer,
  busy = false,
}) {
  const [reopening, setReopening] = useState(false);
  const [callingOff, setCallingOff] = useState(false);
  const items = useMemo(() => normalizeItems(order?.items), [order]);
  const totals = useMemo(() => orderTotals(order, deliveries), [order, deliveries]);
  const delivery = useMemo(() => deliveryForOrder(order, deliveries), [order, deliveries]);
  const owed = useMemo(() => backorderLines(order), [order]);
  const followUp = useMemo(() => deliveriesForOrder(order, deliveries).find(isBackorderDelivery), [order, deliveries]);

  if (!order) return <NotFoundState noun="order" onBack={onBack} />;

  const waiting = daysWaiting(order);
  const isDone = order.status === ORDER_STATUS.COMPLETED;
  const isCancelled = order.status === ORDER_STATUS.CANCELLED;
  const correction = lastPriceAdjustment(order);
  const returns = returnHistory(order);
  const delivered = stockLines(order).some((line) => committedOf(line) > 0);
  const stageIndex = delivery ? DELIVERY_STAGES.findIndex((s) => s.value === delivery.status) : -1;
  const history = [
    { at: order.createdAt, what: `Order taken for ${order.customerName}` },
    ...(order.priceAdjustments || []).map((p) => ({ at: p.changedAt, what: `Price changed from ${formatPeso(p.oldTotal)} to ${formatPeso(p.newTotal)}${p.changedBy ? ` by ${p.changedBy}` : ""}` })),
    ...returns.map((r) => ({ at: r.at, what: r.resolution === "refund" ? `${formatPeso(r.amount)} given back` : `${r.replacementQuantity} × ${r.replacementName} sent as a replacement` })),
    ...(isDone ? [{ at: order.stockCommittedAt, what: "Marked as done" }] : []),
    ...(isCancelled ? [{ at: null, what: "Called off" }] : []),
  ].filter((h) => h.what).sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));

  return (
    <Page>
      <OrderSlip order={order} customer={customer} delivery={delivery} deliveries={deliveries} />

      <PageHeader
        back={{ label: "Back to Orders", onClick: onBack }}
        title={`Order #${order.id}`}
        titleBadge={
          <span className="inline-flex flex-wrap items-center gap-2">
            {delivery ? <StageBadge status={delivery.status} /> : null}
            <StatusPill label={orderLabel(order.status)} tone={orderTone(order.status)} />
            {hasBackorder(order) ? <Badge variant="warning">Goods still owed</Badge> : null}
          </span>
        }
        description={
          <>
            {customer && onOpenCustomer ? (
              <TextLink className="text-13" onClick={() => onOpenCustomer(customer.id)}>{order.customerName}</TextLink>
            ) : (
              <span className="font-medium text-fg-2">{order.customerName}</span>
            )}
            {` · taken ${formatShortDate(order.createdAt)}`}
            {delivery ? ` · ${dueLabel(delivery).toLowerCase()}` : ""}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={onPrint}>
              <Printer aria-hidden="true" />
              Print slip
            </Button>
            {!isDone && !isCancelled ? (
              <Button variant="outline" onClick={onMarkDone} disabled={busy}>
                <CheckCircle aria-hidden="true" />
                {busy ? "Working…" : "Mark as done"}
              </Button>
            ) : null}
            {canHandleMoney && !isCancelled && !isDone ? (
              <Button variant="outline" onClick={() => setCallingOff(true)} disabled={busy}>Cancel order</Button>
            ) : null}
            {canEdit ? (
              <Button onClick={onEdit} disabled={busy}>
                <PencilSimple aria-hidden="true" />
                Edit order
              </Button>
            ) : null}
          </>
        }
      />

      {isCancelled ? (
        <Callout tone="red" icon={<XCircle />} title="This order was cancelled.">
          Nothing on it is being made and no stock is set aside for it. It is kept so the record of what was asked for is not lost.
        </Callout>
      ) : null}
      {hasBackorder(order) ? (
        <Callout
          tone="amber"
          icon={<Package />}
          title="Some of this order has not gone out yet"
          action={followUp && onOpenDelivery ? (
            <Button variant="outline" size="sm" onClick={() => onOpenDelivery(followUp.id)}>Open the second delivery</Button>
          ) : null}
        >
          {owed.map((line) => (
            <span key={line.index} className="block"><span className="font-medium text-foreground">{outstandingOf(line)} × {line.name}</span> still to go.</span>
          ))}
          The rest was delivered and has come off the shelf. What is listed here is still set aside for {order.customerName}.
        </Callout>
      ) : null}
      {correction ? (
        <Callout tone="neutral" icon={<Info />} title={`Price changed on ${formatShortDate(correction.changedAt)} by ${correction.changedBy || "somebody"}`}>
          It went from {formatPeso(correction.oldTotal)} to {formatPeso(correction.newTotal)}. Reason: {priceReasonLabel(correction.reason).toLowerCase()}.
        </Callout>
      ) : null}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <Panel id="od-items" title="Items">
            {items.length === 0 ? (
              <p className="m-0 px-4 py-6 text-13 text-muted-fg">Nothing has been added to this order yet.</p>
            ) : (
              <Table minWidth={520} aria-label="Order items">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Price</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={`${item.name}-${index}`} className="h-auto">
                      <TableCell className="whitespace-normal py-2">
                        <span className="font-medium">{item.name}</span>
                        {item.notes || item.description || item.reason ? (
                          <span className="block text-xs text-muted-fg">{item.notes || item.description || item.reason}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right text-fg-2">{formatPeso(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPeso(item.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="border-t border-border">
              <Totals order={order} totals={totals} />
            </div>
          </Panel>

          <Panel
            id="od-del"
            title="Delivery"
            action={delivery && onOpenDelivery ? <TextLink onClick={() => onOpenDelivery(delivery.id)}>Open delivery</TextLink> : null}
          >
            {delivery ? (
              <>
                <ol aria-label="Delivery stage" className="m-0 grid list-none grid-cols-5 gap-1.5 border-b border-row-divider px-4 py-3.5 text-xs">
                  {DELIVERY_STAGES.map((stage, index) => (
                    <li
                      key={stage.value}
                      aria-current={index === stageIndex ? "step" : undefined}
                      className={cn("flex flex-col gap-1.5", index > stageIndex && "text-muted-fg", index === stageIndex && "font-semibold")}
                    >
                      <span className={cn("h-1 rounded-sm", index <= stageIndex ? "bg-primary" : "bg-muted-strong")} />
                      {STAGE_LOOK[stage.value]?.label ?? stage.label}
                    </li>
                  ))}
                </ol>
                <div className="grid gap-3 px-4 py-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-13 font-medium text-muted-fg">Deliver on</span>
                    <span className={isLate(delivery) ? "text-danger-fg" : undefined}>
                      {delivery.dueOn ? `${formatShortDate(delivery.dueOn)}${isLate(delivery) ? " · late" : ""}` : "No date promised"}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-13 font-medium text-muted-fg">Address</span>
                    <span>{delivery.location || "No address"}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-13 font-medium text-muted-fg">Driver</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={delivery.driver ? undefined : "text-muted-fg"}>{delivery.driver || "Nobody yet"}</span>
                      {onAssignDriver && ![DELIVERY_STAGE.ARRIVED].includes(delivery.status) ? (
                        <TextLink onClick={onAssignDriver}>{delivery.driver ? "Change" : "Assign"}</TextLink>
                      ) : null}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-13 text-muted-fg">
                No delivery on this order.
                {onAssignDriver ? <TextLink onClick={onAssignDriver}>Assign a driver</TextLink> : null}
              </div>
            )}
          </Panel>

          <Panel
            id="od-pay"
            title="Payments"
            action={<Button variant="outline" size="sm" disabled title="Payments are not recorded in the system yet">Record payment</Button>}
          >
            {returns.length === 0 ? (
              <p className="m-0 px-4 py-3 text-13 text-muted-fg">No money has been given back on this order.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {returns.map((entry, index) => (
                  <li key={entry.id ?? index} className="flex flex-col gap-0.5 border-b border-row-divider px-4 py-2.5 text-13 last:border-b-0">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {entry.resolution === "refund"
                          ? `${formatPeso(entry.amount)} given back · ${refundMethodLabel(entry.method)}`
                          : `Replaced: ${entry.replacementQuantity} × ${entry.replacementName} sent out`}
                      </span>
                      <span className="text-muted-fg">{formatShortDate(entry.at)}{entry.handledBy ? ` · ${entry.handledBy}` : ""}</span>
                    </span>
                    <span className="text-fg-2">
                      {entry.resolution === "refund" ? refundReasonLabel(entry.reason) : replacementReasonLabel(entry.reason)}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </span>
                    {(entry.resolution === "refund" ? entry.restockedItems || [] : [entry]).map((line, lineIndex) => (
                      <span key={lineIndex} className="text-xs text-muted-fg">
                        {line.quantity} × {line.name} {entry.resolution === "refund" ? "" : "came back "}— {dispositionLabel(line.disposition).toLowerCase()}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {canHandleMoney && !isCancelled ? (
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                <Button variant="outline" size="sm" disabled={busy} onClick={onRefund}>
                  <Money aria-hidden="true" />
                  Give money back
                </Button>
                {delivered && onReplace ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={onReplace}>
                    <Repeat aria-hidden="true" />
                    Replace goods
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" disabled={busy} onClick={onAdjustPrice}>
                  <Tag aria-hidden="true" />
                  Fix the price
                </Button>
              </div>
            ) : null}
          </Panel>

          {canHandleMoney && isDone ? (
            <DangerBlock
              title="Marked as done by mistake?"
              action={<Button variant="outline" disabled={busy} onClick={() => setReopening(true)}>Put it back to waiting</Button>}
            >
              Everything this order took off the shelf goes back on it, and the order returns to Waiting. The activity log keeps who marked it done and when.
              {order.stockCommittedAt == null ? " Nothing was taken off the shelf for this one, so only the status changes." : ""}
            </DangerBlock>
          ) : null}
          {canHandleMoney && !isCancelled && !isDone && !canEdit && editBlocker ? (
            <p className="m-0 text-13 text-muted-fg">{editBlocker}</p>
          ) : null}
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <Panel id="od-cust" title="Customer">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-13">
              <dt className="text-muted-fg">Name</dt>
              <dd className="m-0">{customer && onOpenCustomer ? <TextLink className="text-13" onClick={() => onOpenCustomer(customer.id)}>{order.customerName}</TextLink> : order.customerName}</dd>
              {!canViewCustomers ? null : customer ? (
                <>
                  <dt className="text-muted-fg">Phone</dt>
                  <dd className="m-0">{customer.contactNumber ? <a href={`tel:${String(customer.contactNumber).replace(/[^\d+]/g, "")}`}>{customer.contactNumber}</a> : "—"}</dd>
                  <dt className="text-muted-fg">Address</dt>
                  <dd className="m-0">{customer.address || "—"}</dd>
                </>
              ) : null}
            </dl>
            {!canViewCustomers ? (
              <p className="m-0 border-t border-row-divider px-4 py-2.5 text-13 text-muted-fg">Customer contact details are kept to the office.</p>
            ) : !customer ? (
              <p className="m-0 border-t border-row-divider px-4 py-2.5 text-13 text-muted-fg">Written against a name rather than a saved customer, so there is no phone number on it.</p>
            ) : null}
            {waiting !== null && waiting >= 1 && !isDone && !isCancelled ? (
              <p className="m-0 border-t border-row-divider px-4 py-2.5 text-13 text-warning-fg">
                Waiting {waiting} {waiting === 1 ? "day" : "days"}{delivery?.driver ? ` · ${delivery.driver} is taking it` : " · nobody is taking it yet"}
              </p>
            ) : null}
          </Panel>

          <Panel id="od-hist" title="History">
            <ol className="m-0 list-none px-4 py-3 text-13">
              {history.map((entry, index) => (
                <li key={index} className="flex gap-3 py-1">
                  <span className="w-24 shrink-0 whitespace-nowrap text-muted-fg">{entry.at ? (new Date(entry.at).toDateString() === new Date().toDateString() ? timeLabel(entry.at) : formatShortDate(entry.at)) : "—"}</span>
                  <span>{entry.what}</span>
                </li>
              ))}
            </ol>
          </Panel>
          {delivery?.amount ? (
            <p className="m-0 flex items-center gap-2 text-13 text-muted-fg"><Truck className="size-4" aria-hidden="true" />Delivery charge {formatPeso(delivery.amount)}</p>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={reopening}
        onOpenChange={(next) => !next && setReopening(false)}
        title={`Put order #${order.id} back to waiting?`}
        intent="forward"
        consequences={
          <>
            {order.stockCommittedAt == null ? "Nothing was taken off the shelf for this order, so only its status changes." : "Everything this order took off the shelf goes back on it."}{" "}
            The order returns to Waiting. The activity log keeps the record of it having been marked done.
          </>
        }
        confirmLabel="Yes, put it back"
        keepLabel="Leave it done"
        busy={busy}
        onConfirm={async () => {
          await onReopen?.(order);
          setReopening(false);
        }}
      />
      <ConfirmDialog
        open={callingOff}
        onOpenChange={(next) => !next && setCallingOff(false)}
        title={`Cancel order #${order.id} for ${order.customerName}?`}
        consequences={
          <>
            The order reads Cancelled from now on and anything it was holding goes back on the shelf. It stays in the orders list and the activity log. No money is recorded as moving, because none did.
            {delivery ? (
              <>
                {" "}
                {[DELIVERY_STAGE.ON_THE_WAY, DELIVERY_STAGE.ARRIVED].includes(delivery.status)
                  ? "Its delivery has already gone out, so that record stays on the board."
                  : "The delivery waiting to carry it comes off the deliveries board."}
              </>
            ) : null}
          </>
        }
        confirmLabel="Yes, cancel it"
        keepLabel="Keep the order"
        busy={busy}
        onConfirm={async () => {
          await onCancelOrder?.(order);
          setCallingOff(false);
        }}
      />
    </Page>
  );
}
