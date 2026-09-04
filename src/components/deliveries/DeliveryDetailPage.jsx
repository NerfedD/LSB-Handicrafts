import { useMemo } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Hammer,
  History,
  Inbox,
  MapPin,
  PackageCheck,
  Truck,
  Undo2,
  UserRound,
} from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import IconChip, { Mono } from "../shared/Chip";
import FactTable from "../shared/FactTable";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import { activityIcon } from "../shared/activityIcons";
import { whenLabel } from "../../utils/activityLog";
import { deliveryStage } from "../../utils/copy";
import { DELIVERY_STAGE } from "../../utils/constants";
import {
  customerFrom,
  dueLabel,
  nextStage,
  orderRefFrom,
  previousStage,
} from "../../utils/deliveries";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One delivery — screen 2l.
 *
 * ONE BIG BUTTON. Moving a delivery forward is the single thing this screen
 * exists to do, so it is a 56px green button with the outcome written on it
 * ("It arrived", "It is on the way") rather than a status dropdown. A dropdown
 * asks somebody standing in a yard with a phone to find the right option in a
 * list; a button asks them to press the obvious thing.
 *
 * "MOVE BACK" IS THE UNDO, and it is deliberately quieter — outlined, second,
 * and labelled with where it goes back to. Every stage change writes a history
 * entry automatically, so an accidental press is recoverable AND visible rather
 * than silently rewriting where the delivery has been.
 *
 * THE HISTORY WRITES ITSELF. Nobody types it. That is what makes it worth
 * reading: a log people have to maintain is a log that is empty by March.
 */

const STAGE_ICONS = {
  inbox: <Inbox />,
  hammer: <Hammer />,
  "package-check": <PackageCheck />,
  truck: <Truck />,
  "circle-check": <CircleCheck />,
};

export default function DeliveryDetailPage({
  delivery,
  activity = [],
  onBack,
  onMoveForward,
  onMoveBack,
  onAssignDriver,
  onOpenOrder,
  busy = false,
}) {
  const history = useMemo(
    () =>
      delivery
        ? activity.filter((entry) => entry.subject === `delivery:${delivery.id}`)
        : [],
    [activity, delivery]
  );

  if (!delivery) return <NotFoundState noun="delivery" onBack={onBack} />;

  const stage = deliveryStage(delivery.status);
  const forward = nextStage(delivery);
  const backward = previousStage(delivery);
  const orderRef = orderRefFrom(delivery);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        The deliveries board
      </Button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ---- where it is now ---- */}
          <Card className="p-5.5">
            <div className="flex items-center gap-4">
              <IconChip icon={STAGE_ICONS[stage.icon]} tone={stage.tone} size="xl" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-muted">
                  Where it is now
                </p>
                <p className="text-[24px] font-extrabold leading-tight tracking-[-0.01em] text-ink">
                  {stage.label}
                </p>
                <p className="pt-0.5 text-[15px] text-muted">
                  {dueLabel(delivery)}
                </p>
              </div>
            </div>

            {/* The two moves. Forward is the big green one; back is quieter and
                names where it returns to, so nobody has to guess what "back"
                means from a stage they cannot see. */}
            <div className="flex flex-col gap-3 pt-5 sm:flex-row">
              {forward ? (
                <Button
                  variant="green"
                  size="xl"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => onMoveForward(forward.value)}
                >
                  <ArrowRight className="h-5.5 w-5.5" />
                  {forward.value === DELIVERY_STAGE.ARRIVED
                    ? "It arrived"
                    : `It is ${forward.label.toLowerCase()}`}
                </Button>
              ) : (
                <div className="flex flex-1 items-center gap-2.5 rounded-field bg-tint-green px-4 py-3 text-[16px] font-bold text-green dark:text-dk-green">
                  <CircleCheck className="h-5.5 w-5.5" aria-hidden="true" />
                  This one is done.
                </div>
              )}

              {backward && (
                <Button
                  variant="outline"
                  size="xl"
                  disabled={busy}
                  onClick={() => onMoveBack(backward.value)}
                >
                  <Undo2 className="h-5 w-5" />
                  Move back to {backward.label.toLowerCase()}
                </Button>
              )}
            </div>
          </Card>

          {/* ---- history ---- */}
          <Card>
            <CardHeader>
              <IconChip icon={<History />} tone="neutral" size="sm" />
              <CardTitle>What has happened to it</CardTitle>
            </CardHeader>

            {history.length === 0 ? (
              <EmptySlot className="py-10 text-[15px]">
                Nothing yet. Every time this delivery moves, a line appears here saying what
                changed, when, and who did it.
              </EmptySlot>
            ) : (
              <ul>
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3.5 border-b border-hair px-5.5 py-3.5 last:border-b-0"
                  >
                    <IconChip icon={activityIcon(entry.icon)} tone={entry.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] leading-[1.45] text-ink">
                        <strong className="font-extrabold">{entry.who}</strong> {entry.what}
                      </p>
                      <p className="pt-0.5 text-[13.5px] text-muted">
                        {whenLabel(entry.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---- where it is going ---- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <IconChip icon={<MapPin />} tone="cobalt" size="sm" />
              <CardTitle>Where it is going</CardTitle>
            </CardHeader>
            <FactTable
              rows={[
                { label: "Delivery number", value: `#${delivery.id}`, mono: true },
                { label: "Customer", value: customerFrom(delivery) || null },
                { label: "Address", value: delivery.location || null },
                { label: "What is on it", value: delivery.size || null },
                {
                  label: "Delivery charge",
                  value: delivery.amount ? formatPeso(delivery.amount) : "Free",
                },
                {
                  label: "Promised for",
                  value: delivery.dueOn ? formatShortDate(delivery.dueOn) : null,
                },
                { label: "Raised on", value: formatShortDate(delivery.createdAt) },
              ]}
            />
          </Card>

          <Card>
            <CardHeader>
              <IconChip icon={<UserRound />} tone="clay" size="sm" />
              <CardTitle>Who is taking it</CardTitle>
            </CardHeader>
            <div className="px-5.5 py-4.5">
              {delivery.driver ? (
                <p className="text-[17px] font-bold text-ink">
                  {delivery.driver}
                </p>
              ) : (
                <p className="text-[15.5px] leading-[1.5] text-muted">
                  Nobody has been given this one yet, so it will not leave until somebody is.
                </p>
              )}
              <Button
                variant="outline"
                size="lg"
                block
                className="mt-3.5"
                onClick={onAssignDriver}
              >
                <UserRound className="h-5 w-5" />
                {delivery.driver ? "Change who takes it" : "Assign someone"}
              </Button>
            </div>
          </Card>

          {orderRef && (
            <Button variant="outline" size="lg" block onClick={() => onOpenOrder(orderRef)}>
              <CalendarClock className="h-5 w-5" />
              Open order <Mono className="text-[15px]">#{orderRef}</Mono>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
