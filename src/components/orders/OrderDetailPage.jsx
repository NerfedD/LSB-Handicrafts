import { useMemo } from "react";

import {
  ArrowLeft,
  Banknote,
  CircleCheck,
  CircleX,
  Clock,
  Info,
  MapPin,
  PackageOpen,
  Phone,
  Printer,
  Tag,
  Truck,
  UserRound,
} from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Callout, { DangerBlock } from "../shared/Callout";
import IconChip, { Avatar, Mono } from "../shared/Chip";
import FactTable from "../shared/FactTable";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import StageTracker from "../shared/StageTracker";
import StatusPill from "../shared/StatusPill";
import { ORDER_STATUS } from "../../utils/constants";
import {
  dispositionLabel,
  orderLabel,
  orderTone,
  priceReasonLabel,
  refundMethodLabel,
  refundReasonLabel,
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
  orderProgress,
  orderTotals,
} from "../../utils/orders";
import { outstandingOf } from "../../utils/stockLedger";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One order — screen 2j.
 *
 * THE TRACKER REPLACES THE STATUS WORD. Four stages with a date under each,
 * done ones filled green, the current one cobalt, the future ones open — so
 * anybody, including somebody on their first day, can see both where the order
 * is AND what happens after. "Pending" says neither. The stages are derived
 * from the order and its delivery rather than stored (see utils/orders), so
 * there is no second place that can disagree about where the order is.
 *
 * ONE FORWARD ACTION. "Mark as done" is green, in the header, and it is the
 * only control on the screen that changes where the order stands. Marking an
 * order done deducts stock, which is a real, one-way event — so it is a
 * deliberate press on the order itself, never a dropdown in a list.
 *
 * THE WAITING CALLOUT IS NOT A BADGE. An order that has sat for four days is a
 * problem with an owner, so the amber block says how long AND offers the thing
 * that unblocks it: give it to somebody.
 *
 * MONEY LIVES IN ITS OWN OUTLINED BLOCK AT THE BOTTOM. Rule 6: giving money
 * back and changing what an order costs are not recoverable by pressing
 * something again, so they are never a control in the header beside Print. They
 * are a bordered section that names what each one does, and it only renders for
 * somebody allowed to use it — the courtesy half of a permission whose real
 * half is the guard trigger on public.orders.
 *
 * WHAT WAS DONE TO THE MONEY IS SHOWN, NOT JUST THE RESULT. A total that moved
 * with no explanation is indistinguishable from a mistake, so a corrected price
 * carries a banner naming the day, the person and the reason, and every refund
 * is listed with what happened to the goods.
 */
export default function OrderDetailPage({
  order,
  customer,
  deliveries = [],
  canHandleMoney = false,
  onBack,
  onMarkDone,
  onAssignDriver,
  onPrint,
  onRefund,
  onAdjustPrice,
  onOpenDelivery,
  busy = false,
}) {
  const items = useMemo(() => normalizeItems(order?.items), [order]);
  const progress = useMemo(() => orderProgress(order, deliveries), [order, deliveries]);
  const totals = useMemo(() => orderTotals(order, deliveries), [order, deliveries]);
  const delivery = useMemo(() => deliveryForOrder(order, deliveries), [order, deliveries]);
  const owed = useMemo(() => backorderLines(order), [order]);
  const followUp = useMemo(
    () => deliveriesForOrder(order, deliveries).find(isBackorderDelivery),
    [order, deliveries]
  );

  if (!order) return <NotFoundState noun="order" onBack={onBack} />;

  const waiting = daysWaiting(order);
  const isDone = order.status === ORDER_STATUS.COMPLETED;
  const isCancelled = order.status === ORDER_STATUS.CANCELLED;
  const partial = hasBackorder(order);
  const correction = lastPriceAdjustment(order);
  const refunds = Array.isArray(order.refundHistory) ? order.refundHistory : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
          All orders
        </Button>

        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onPrint}>
            <Printer className="h-5 w-5" />
            Print
          </Button>
          {!isDone && order.status !== ORDER_STATUS.CANCELLED && (
            <Button variant="green" onClick={onMarkDone} disabled={busy}>
              <CircleCheck className="h-5 w-5" />
              {busy ? "Working…" : "Mark as done"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ---- where it stands ---- */}
          <Card className="p-5.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-5">
              <div>
                <Mono className="text-[15px]">#{order.id}</Mono>
                <h2 className="text-[23px] font-extrabold tracking-[-0.02em] text-ink">
                  {order.customerName}
                </h2>
              </div>
              <StatusPill
                label={orderLabel(order.status)}
                tone={orderTone(order.status)}
                size="sm"
              />
            </div>

            {progress.cancelled ? (
              <Callout tone="red" icon={<CircleX />} title="This order was cancelled.">
                Nothing on it is being made and no stock is set aside for it. It is kept so
                the record of what was asked for is not lost.
              </Callout>
            ) : (
              <>
                {/* Horizontal on a desktop, stacked and compact below — a
                    four-stage tracker with labels under the circles cannot fit
                    an 834px column without them colliding. */}
                <div className="hidden lg:block">
                  <StageTracker stages={progress.stages} current={progress.current} />
                </div>
                <div className="lg:hidden">
                  <StageTracker stages={progress.stages} current={progress.current} compact />
                </div>
              </>
            )}
          </Card>

          {/* ---- what is still owed ---- */}
          {partial && (
            <Callout
              tone="amber"
              icon={<PackageOpen />}
              title="Some of this order has not gone out yet"
              action={
                followUp &&
                onOpenDelivery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenDelivery(followUp.id)}
                  >
                    <Truck className="h-4.5 w-4.5" />
                    Open the second delivery
                  </Button>
                )
              }
            >
              {owed.map((line) => (
                <span key={line.index} className="block">
                  <strong className="font-bold text-ink">
                    {outstandingOf(line)} × {line.name}
                  </strong>{" "}
                  still to go.
                </span>
              ))}
              <span className="block pt-2">
                The rest was delivered and has come off the shelf. What is listed here is
                still set aside for {order.customerName} and is not sellable to anybody
                else.
              </span>
            </Callout>
          )}

          {/* ---- the price was changed after it was sent ---- */}
          {correction && (
            <Callout
              tone="cobalt"
              icon={<Info />}
              title={`Price changed on ${formatShortDate(correction.changedAt)} by ${correction.changedBy || "somebody"}`}
            >
              It went from{" "}
              <strong className="font-bold text-ink">{formatPeso(correction.oldTotal)}</strong>{" "}
              to{" "}
              <strong className="font-bold text-ink">{formatPeso(correction.newTotal)}</strong>.
              Reason: {priceReasonLabel(correction.reason).toLowerCase()}.
            </Callout>
          )}

          {/* ---- what is on it ---- */}
          <Card>
            <CardHeader>
              <CardTitle>What is on this order</CardTitle>
            </CardHeader>

            {items.length === 0 ? (
              <EmptySlot className="py-10 text-[15px]">
                Nothing has been added to this order yet.
              </EmptySlot>
            ) : (
              <>
                <Table minWidth={560}>
                  <TableCaption>The things on this order and what they cost</TableCaption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24 text-right">How many</TableHead>
                      <TableHead className="w-32 text-right">Each</TableHead>
                      <TableHead className="w-36 text-right">Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={`${item.name}-${index}`}>
                        <TableCell>
                          <p className="text-[16.5px] font-bold">{item.name}</p>
                          {/* A cut-to-size or custom line is priced by hand, so
                              the note explaining it is the only record of why
                              the number is what it is. */}
                          {(item.notes || item.description || item.reason) && (
                            <p className="pt-0.5 text-[14px] text-muted">
                              {item.notes || item.description || item.reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-[16px] tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-[16px] tabular-nums">
                          {formatPeso(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-[16.5px] font-bold tabular-nums">
                          {formatPeso(item.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* The footer band, and the one number on the screen set at
                    28px: what the customer actually pays. */}
                <div className="bg-paper-2 px-5.5 py-4.5">
                  <dl className="ml-auto flex max-w-[320px] flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-[15.5px] text-muted">
                        Items total
                      </dt>
                      <dd className="text-[16.5px] font-bold tabular-nums">
                        {formatPeso(totals.items)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-[15.5px] text-muted">Delivery</dt>
                      <dd className="text-[16.5px] font-bold tabular-nums">
                        {totals.delivery > 0 ? formatPeso(totals.delivery) : "Free"}
                      </dd>
                    </div>
                    <div
                      className="h-px bg-rule"
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-[16.5px] font-extrabold text-ink">
                        Total to pay
                      </dt>
                      <dd className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums text-ink">
                        {formatPeso(totals.total)}
                      </dd>
                    </div>

                    {/* Only once money has actually gone back. An order with no
                        refund should not carry a row of zeroes explaining a
                        thing that never happened. "Total to pay" keeps its 28px
                        as the one number on the screen set that size, and what
                        they are left owing sits under it as the correction. */}
                    {totals.refunded > 0 && (
                      <>
                        <div className="flex items-baseline justify-between gap-6">
                          <dt className="text-[15.5px] text-muted">Given back</dt>
                          <dd className="text-[16.5px] font-bold tabular-nums text-red-text">
                            −{formatPeso(totals.refunded)}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-6">
                          <dt className="text-[16.5px] font-extrabold text-ink">
                            What they still owe
                          </dt>
                          <dd className="text-[19px] font-extrabold tabular-nums text-ink">
                            {formatPeso(totals.net)}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
              </>
            )}
          </Card>

          {/* ---- what came back ---- */}
          {refunds.length > 0 && (
            <Card>
              <CardHeader>
                <IconChip icon={<Banknote />} tone="red" size="sm" />
                <CardTitle>Money given back</CardTitle>
              </CardHeader>
              <ul>
                {refunds.map((refund, index) => (
                  <li
                    key={refund.id ?? index}
                    className="border-b border-hair px-5.5 py-4 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="text-[16.5px] font-bold text-ink">
                        {formatPeso(refund.amount)} · {refundMethodLabel(refund.method)}
                      </p>
                      <p className="text-[14.5px] text-muted">
                        {formatShortDate(refund.refundedAt)}
                        {refund.refundedBy ? ` · ${refund.refundedBy}` : ""}
                      </p>
                    </div>
                    <p className="pt-1 text-[15px] leading-[1.5] text-ink-2">
                      {refundReasonLabel(refund.reason)}
                    </p>
                    {Array.isArray(refund.restockedItems) &&
                      refund.restockedItems.length > 0 && (
                        <ul className="pt-1.5">
                          {refund.restockedItems.map((line, lineIndex) => (
                            <li
                              key={`${refund.id ?? index}-${lineIndex}`}
                              className="text-[14.5px] text-muted"
                            >
                              {line.quantity} × {line.name} —{" "}
                              {dispositionLabel(line.disposition).toLowerCase()}
                            </li>
                          ))}
                        </ul>
                      )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ---- the only place money moves on an order ---- */}
          {canHandleMoney && !isCancelled && (
            <DangerBlock
              title="Money on this order"
              action={
                <div className="flex flex-wrap gap-3">
                  <Button variant="danger" size="lg" disabled={busy} onClick={onRefund}>
                    <Banknote className="h-5 w-5" />
                    Give money back
                  </Button>
                  <Button variant="outline" size="lg" disabled={busy} onClick={onAdjustPrice}>
                    <Tag className="h-5 w-5" />
                    Fix the price
                  </Button>
                </div>
              }
            >
              Giving money back records where it went and what happened to the goods —
              whether they went back on the shelf or were thrown away. Anything thrown
              away is counted as waste and is not sold again.
              <br />
              <br />
              Fixing the price never overwrites what {order.customerName} was told. The old
              figure is kept beside the new one, with your name and the reason, and it
              shows at the top of this screen from then on.
            </DangerBlock>
          )}
        </div>

        {/* ---- who it is for ---- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Who it is for</CardTitle>
            </CardHeader>

            <div className="flex items-center gap-3.5 px-5.5 py-4.5">
              <Avatar name={order.customerName} tone="navy" size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-extrabold text-ink">
                  {order.customerName}
                </p>
                <p className="pt-0.5 text-[14.5px] text-muted">
                  Ordered {formatShortDate(order.createdAt)}
                </p>
              </div>
            </div>

            {customer ? (
              <FactTable
                className="border-t border-hair"
                rows={[
                  {
                    label: "Phone",
                    value: customer.contactNumber || null,
                    icon: <Phone className="h-4.5 w-4.5" />,
                  },
                  {
                    label: "Where they are",
                    value: customer.address || null,
                    icon: <MapPin className="h-4.5 w-4.5" />,
                  },
                ]}
              />
            ) : (
              <EmptySlot className="border-t border-hair py-6">
                This order was written against a name rather than a saved customer, so there
                is no phone number on it.
              </EmptySlot>
            )}
          </Card>

          {waiting !== null && waiting >= 1 && (
            <Callout
              tone="amber"
              icon={<Clock />}
              title={`Waiting ${waiting} ${waiting === 1 ? "day" : "days"}`}
              action={
                onAssignDriver && (
                  <Button variant="outline" size="sm" onClick={onAssignDriver}>
                    <UserRound className="h-4.5 w-4.5" />
                    {delivery?.driver ? "Change who takes it" : "Assign someone"}
                  </Button>
                )
              }
            >
              {delivery?.driver ? (
                <>
                  <strong className="font-bold text-ink">{delivery.driver}</strong> is taking this
                  one out. It has been on the list since {formatShortDate(order.createdAt)}.
                </>
              ) : (
                <>Nobody has been given this one yet. It has been sitting since{" "}
                {formatShortDate(order.createdAt)}.</>
              )}
            </Callout>
          )}

          {delivery && (
            <Card>
              <CardHeader>
                <IconChip icon={<Truck />} tone="amber" size="sm" />
                <CardTitle>Going out</CardTitle>
              </CardHeader>
              <FactTable
                rows={[
                  { label: "Where to", value: delivery.location || null },
                  { label: "Who is taking it", value: delivery.driver || null },
                  {
                    label: "Delivery charge",
                    value: delivery.amount ? formatPeso(delivery.amount) : "Free",
                  },
                ]}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
