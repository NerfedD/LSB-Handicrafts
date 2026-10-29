import { useEffect, useMemo, useState } from "react";

import { ArrowUUpLeft, CheckCircle, Package, Printer } from "../icons";
import { Button } from "@/components/ui/button";
import Callout from "../shared/Callout";
import { Avatar } from "../shared/Chip";
import { NotFoundState } from "../shared/PageStates";
import { Page, PageHeader, TextLink } from "../shared/page";
import StageBadge from "./StageBadge";
import { STAGE_LOOK } from "./stageLook";
import { cn } from "@/lib/utils";
import { DELIVERY_STAGE } from "../../utils/constants";
import { DELIVERY_STAGES } from "../../utils/copy";
import { customerFrom, dueLabel, nextStage, orderRefFrom, previousStage } from "../../utils/deliveries";
import { timeLabel } from "../../utils/activityLog";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One delivery, drawn to the "18 · Delivery detail" board:
 *
 *   Back to Deliveries → the header (Delivery #, stage, customer · items ·
 *   order · due; Move back a step, Print delivery slip, the next step) → the
 *   five-stage tracker → What's on the truck → Proof of delivery, beside
 *   Where, Driver and History.
 *
 * The header's primary button is the delivery's next step, so it reads
 * "Mark delivered" on the way and "Send out" when it is ready. There is no
 * delivery slip to print yet, so that button is disabled.
 */
function Panel({ id, title, action, children }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3.5">
        <h2 id={id} className="m-0 text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DeliveryDetailPage({
  delivery,
  deliveries = [],
  loadActivity,
  onBack,
  onMoveForward,
  onMoveBack,
  onAssignDriver,
  onOpenOrder,
  onOpenDelivery,
  busy = false,
}) {
  const [history, setHistory] = useState([]);
  const subject = delivery ? `delivery:${delivery.id}` : null;
  useEffect(() => {
    if (!subject || !loadActivity) return undefined;
    let cancelled = false;
    loadActivity(subject).then((result) => {
      if (!cancelled && result.ok) setHistory(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [subject, loadActivity, delivery?.revision]);

  const parent = useMemo(() => deliveries.find((one) => one.id === delivery?.parentDeliveryId), [deliveries, delivery]);
  const child = useMemo(() => deliveries.find((one) => one.parentDeliveryId === delivery?.id), [deliveries, delivery]);

  if (!delivery) return <NotFoundState noun="delivery" onBack={onBack} />;

  const forward = nextStage(delivery);
  const backward = previousStage(delivery);
  const orderRef = orderRefFrom(delivery);
  const stageIndex = DELIVERY_STAGES.findIndex((s) => s.value === delivery.status);
  const manifest = delivery.itemsManifest ?? [];
  const itemCount = manifest.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const done = delivery.status === DELIVERY_STAGE.ARRIVED;
  const verb = STAGE_LOOK[delivery.status]?.verb;

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to Deliveries", onClick: onBack }}
        title={`Delivery #${delivery.id}`}
        titleBadge={<StageBadge status={delivery.status} />}
        description={
          <>
            {customerFrom(delivery) || "No customer named"}
            {itemCount ? ` · ${itemCount} items` : ""}
            {orderRef ? (
              <>
                {" from "}
                <TextLink className="text-13" onClick={() => onOpenOrder(orderRef)}>order #{orderRef}</TextLink>
              </>
            ) : null}
            {` · ${dueLabel(delivery).toLowerCase()}`}
          </>
        }
        actions={
          <>
            {backward ? (
              <Button variant="outline" disabled={busy} onClick={() => onMoveBack(backward.value)}>
                <ArrowUUpLeft aria-hidden="true" />
                Move back a step
              </Button>
            ) : null}
            <Button variant="outline" disabled title="There is no delivery slip to print yet">
              <Printer aria-hidden="true" />
              Print delivery slip
            </Button>
            {forward && verb ? (
              <Button disabled={busy} onClick={() => onMoveForward(forward.value)} aria-haspopup={forward.value === DELIVERY_STAGE.ON_THE_WAY ? "dialog" : undefined}>
                {forward.value === DELIVERY_STAGE.ARRIVED ? <CheckCircle aria-hidden="true" /> : null}
                {verb}
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="Delivery progress" className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-xs">
        <ol className="m-0 grid list-none grid-cols-5 gap-2 p-0 text-xs">
          {DELIVERY_STAGES.map((stage, index) => (
            <li key={stage.value} aria-current={index === stageIndex ? "step" : undefined} className={cn("flex flex-col gap-1.5", index > stageIndex && "text-muted-fg")}>
              <span className={cn("h-1 rounded-sm", index <= stageIndex ? (done ? "bg-success" : "bg-primary") : "bg-muted-strong")} />
              <span className={index === stageIndex ? "font-semibold" : undefined}>{STAGE_LOOK[stage.value]?.label ?? stage.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {parent || child ? (
        <Callout
          tone="amber"
          icon={<Package />}
          title={parent ? "This is the rest of an earlier delivery" : "Some of this was left behind"}
          action={onOpenDelivery ? (
            <Button variant="outline" size="sm" onClick={() => onOpenDelivery((parent ?? child).id)}>
              {parent ? "Open the first run" : "Open the second run"}
            </Button>
          ) : null}
        >
          {parent
            ? "The first run could not take everything, so this one was raised for what was left."
            : "A second delivery was raised for what did not fit. The order stays open until the other arrives."}
        </Callout>
      ) : null}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <Panel id="dd-items" title="What's on the truck">
            {manifest.length === 0 ? (
              <p className="m-0 px-4 py-3 text-13 text-muted-fg">
                {delivery.size ? delivery.size : "What goes on the truck is recorded when it is sent out."}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {manifest.map((line, index) => (
                  <li key={`${line.name}-${index}`} className="flex items-center gap-3 border-b border-row-divider px-4 py-2 text-13 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate font-medium">{line.name}</span>
                    <span>{line.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="dd-proof" title="Proof of delivery">
            {done ? (
              <p className="m-0 flex items-center gap-2 px-4 py-3 text-13">
                <CheckCircle className="size-4 text-success-fg" aria-hidden="true" />
                Arrived{itemCount ? `, ${itemCount} items` : ""}. What went out is on the order.
              </p>
            ) : (
              <p className="m-0 px-4 py-3 text-13 text-muted-fg">
                The driver records what went out when it is sent, and it is marked arrived when it gets there.
              </p>
            )}
          </Panel>
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <Panel id="dd-where" title="Where">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-13">
              <dt className="text-muted-fg">Address</dt><dd className="m-0">{delivery.location || "No address"}</dd>
              <dt className="text-muted-fg">Customer</dt><dd className="m-0">{customerFrom(delivery) || "—"}</dd>
              <dt className="text-muted-fg">Promised</dt><dd className="m-0">{delivery.dueOn ? formatShortDate(delivery.dueOn) : "No date"}</dd>
              <dt className="text-muted-fg">Charge</dt><dd className="m-0">{delivery.amount ? formatPeso(delivery.amount) : "Free"}</dd>
            </dl>
          </Panel>

          <Panel id="dd-driver" title="Driver" action={onAssignDriver && !done ? <Button variant="ghost" size="sm" onClick={onAssignDriver}>{delivery.driver ? "Change" : "Assign"}</Button> : null}>
            <div className="flex items-center gap-3 px-4 py-3">
              {delivery.driver ? (
                <>
                  <Avatar name={delivery.driver} size="sm" />
                  <div className="text-13">
                    <div className="font-medium">{delivery.driver}</div>
                    <div className="text-muted-fg">Raised {formatShortDate(delivery.createdAt)}</div>
                  </div>
                </>
              ) : (
                <p className="m-0 text-13 text-muted-fg">Nobody has been given this one yet, so it will not leave until somebody is.</p>
              )}
            </div>
          </Panel>

          <Panel id="dd-hist" title="History">
            {history.length === 0 ? (
              <p className="m-0 px-4 py-3 text-13 text-muted-fg">Every time this delivery moves, a line appears here.</p>
            ) : (
              <ol className="m-0 list-none px-4 py-3 text-13">
                {history.map((entry) => (
                  <li key={entry.id} className="flex gap-3 py-1">
                    <span className="w-16 shrink-0 text-muted-fg">
                      {entry.at && new Date(entry.at).toDateString() === new Date().toDateString() ? timeLabel(entry.at) : formatShortDate(entry.at)}
                    </span>
                    <span><span className="font-medium">{entry.who}</span> {entry.what}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
