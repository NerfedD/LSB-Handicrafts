import { useMemo } from "react";

import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Clock,
  MapPin,
  Phone,
  Printer,
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
import Callout from "../shared/Callout";
import IconChip, { Avatar, Mono } from "../shared/Chip";
import FactTable from "../shared/FactTable";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import StageTracker from "../shared/StageTracker";
import StatusPill from "../shared/StatusPill";
import { ORDER_STATUS } from "../../utils/constants";
import { orderLabel, orderTone } from "../../utils/copy";
import { normalizeItems } from "../../utils/orderItems";
import {
  daysWaiting,
  deliveryForOrder,
  orderProgress,
  orderTotals,
} from "../../utils/orders";
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
 */
export default function OrderDetailPage({
  order,
  customer,
  deliveries = [],
  onBack,
  onMarkDone,
  onAssignDriver,
  onPrint,
  busy = false,
}) {
  const items = useMemo(() => normalizeItems(order?.items), [order]);
  const progress = useMemo(() => orderProgress(order, deliveries), [order, deliveries]);
  const totals = useMemo(() => orderTotals(order, deliveries), [order, deliveries]);
  const delivery = useMemo(() => deliveryForOrder(order, deliveries), [order, deliveries]);

  if (!order) return <NotFoundState noun="order" onBack={onBack} />;

  const waiting = daysWaiting(order);
  const isDone = order.status === ORDER_STATUS.COMPLETED;

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
                  </dl>
                </div>
              </>
            )}
          </Card>
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
