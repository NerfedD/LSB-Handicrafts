import { useEffect, useMemo, useState } from "react";

import { CaretRight, PencilSimple, Receipt } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DangerBlock } from "../shared/Callout";
import { Avatar, Mono } from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { Fact, Page, PageHeader, SectionCard, StatCard, StatCards } from "../shared/page";
import { orderLabel, orderTone } from "../../utils/copy";
import { customerSummary, DEFAULT_LOYALTY } from "../../utils/customers";
import { formatLongDate, formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One customer, an app-only screen built from the Customers board's side
 * panel and the detail boards' parts: header, two stat cards, their orders
 * and how to reach them.
 *
 * TWO NUMBERS AND TWO BUTTONS. What somebody standing at a counter needs from
 * a customer's screen is how much they matter (orders placed, spent with us)
 * and the ability to start the next order. Everything else — the address, the
 * email, when they were added — is reference, and sits below in a fact table
 * where it can be looked up rather than read.
 *
 * "WRITE THEM AN ORDER" IS THE PRIMARY. Not "Edit". Editing a customer's
 * details is housekeeping; the reason their screen is open is almost always
 * that they want to buy something.
 *
 * THEIR WHOLE HISTORY, NOT THE LAST FEW MONTHS. The app keeps only open and
 * recent orders in memory, so this screen asks for this customer's own orders
 * when it opens (`loadOrders`), and the totals come from the database's
 * per-customer sums.
 *
 * REMOVING ONE IS ADMIN-ONLY AND REFUSED WHILE AN ORDER IS OPEN -- by the
 * database as well as here. Past orders survive a removal and keep the name
 * they were written under; what is destroyed is the only record of how to
 * REACH them: the phone number, the email, the address.
 *
 * Which is exactly why an open order blocks it. Losing the phone number of
 * somebody you still owe goods to is not a tidy-up, and it is the one case
 * where the consequence is not recoverable from the order itself. The block
 * still renders and explains the refusal rather than silently disappearing —
 * "why can't I delete this" deserves an answer on the screen.
 */
export default function CustomerDetailPage({
  customer,
  customerStats = new Map(),
  loyalty = DEFAULT_LOYALTY,
  /** Reads this customer's own orders: (customer) => Promise<{ ok, data }>. */
  loadOrders,
  canEdit = false,
  canDelete = false,
  onBack,
  onEdit,
  onWriteOrder,
  onOpenOrder,
  onDelete,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState({ key: null, orders: [], failed: false });
  const summary = useMemo(
    () => (customer ? customerSummary(customer, customerStats, loyalty) : null),
    [customer, customerStats, loyalty]
  );

  // Re-read when the totals move, so an order just written shows up here.
  const historyKey = customer ? `${customer.id}:${customer.name}:${summary.orderCount}:${summary.openCount}` : null;
  useEffect(() => {
    if (!customer || !loadOrders) return undefined;
    let cancelled = false;
    loadOrders(customer).then((result) => {
      if (!cancelled) setHistory({ key: historyKey, orders: result.ok ? result.data : [], failed: !result.ok });
    });
    return () => { cancelled = true; };
    // historyKey covers the customer fields that decide which orders are theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey, loadOrders]);
  const theirOrders = history.orders;
  const historyLoaded = history.key === historyKey;

  if (!customer) return <NotFoundState noun="customer" onBack={onBack} />;

  const openCount = summary.openCount;
  const blocked = openCount > 0;

  async function runDelete() {
    setWorking(true);
    await onDelete?.(customer);
    setWorking(false);
    setConfirming(false);
  }

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to Customers", onClick: onBack }}
        leading={<Avatar name={customer.name} size="lg" photo={false} />}
        title={customer.name}
        titleBadge={
          <Badge variant="secondary">{summary.isBusiness ? "Business" : "Walk-in"}</Badge>
        }
        description={`On record since ${formatLongDate(customer.createdAt)}`}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => onEdit(customer.id)}>
                <PencilSimple aria-hidden="true" />
                Edit details
              </Button>
            )}
            <Button onClick={() => onWriteOrder(customer)}>
              <Receipt aria-hidden="true" />
              Write them an order
            </Button>
          </>
        }
      />

      <StatCards label="Their numbers">
        <StatCard
          label="Orders placed"
          value={summary.orderCount}
          caption={
            summary.rewardEligible
              ? `Loyalty reward: ${loyalty.rewardPercent}% off their next order`
              : summary.isRegular
                ? "A regular"
                : "Finished and open orders"
          }
        />
        <StatCard
          label="Spent with us"
          value={formatPeso(summary.spent)}
          caption={
            summary.lastOrderAt
              ? `Last order ${formatShortDate(new Date(summary.lastOrderAt).toISOString())}`
              : "No orders yet"
          }
        />
        <StatCard
          label="Open orders"
          value={openCount}
          caption={summary.hasOpenOrder ? "Still waiting" : "None waiting"}
        />
      </StatCards>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="What they have ordered" bodyClassName="p-0">
          {!historyLoaded ? (
            <EmptySlot>Loading their orders…</EmptySlot>
          ) : history.failed ? (
            <EmptySlot>Their orders could not be loaded. Reopen this screen to try again.</EmptySlot>
          ) : theirOrders.length === 0 ? (
            <EmptySlot>Nothing yet. Orders written for this customer will be listed here.</EmptySlot>
          ) : (
            <ul className="m-0 list-none p-0">
              {theirOrders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => onOpenOrder(order.id)}
                    className="flex h-10 w-full items-center gap-3 border-0 border-b border-row-divider bg-transparent px-4 text-left text-13 last:border-b-0 hover:bg-row-hover"
                  >
                    <Mono className="w-14 shrink-0">#{order.id}</Mono>
                    <span className="min-w-0 flex-1 truncate">{formatShortDate(order.createdAt)}</span>
                    <StatusPill label={orderLabel(order.status)} tone={orderTone(order.status)} size="sm" />
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatPeso(order.totalAmount)}</span>
                    <CaretRight className="size-4 shrink-0 text-muted-fg" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="How to reach them">
          <dl className="m-0 flex flex-col gap-3 px-4 pb-4">
            <Fact label="Phone">{customer.contactNumber || "Not given"}</Fact>
            <Fact label="Email">{customer.email || "Not given"}</Fact>
            <Fact label="Delivery address">{customer.address || "Not given"}</Fact>
            <Fact label="On record since">{formatLongDate(customer.createdAt)}</Fact>
          </dl>
        </SectionCard>
      </div>

      {/* ---- the only place a customer can be removed ---- */}
      {canDelete && (
        <DangerBlock
          title="Remove this customer for good"
          action={
            blocked ? null : (
              <Button variant="destructive-outline" onClick={() => setConfirming(true)}>
                Remove {customer.name}
              </Button>
            )
          }
        >
          {blocked ? (
            <>
              {customer.name} has {openCount === 1 ? "an order" : `${openCount} orders`} still
              waiting, so they cannot be removed yet: you would lose the phone number of
              somebody you still owe goods to. Finish or cancel{" "}
              {openCount === 1 ? "that order" : "those orders"} first.
            </>
          ) : (
            <>
              Their phone number, email and address are deleted, and they leave the customers
              list. Their past orders stay, under {customer.name}&rsquo;s name, but nothing will
              link back to a way of contacting them. This cannot be undone. If they have simply
              not been in for a while, leaving the record costs nothing.
            </>
          )}
        </DangerBlock>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        title={`Remove ${customer.name}?`}
        consequences={
          <>
            Their phone number, email and address are deleted with them. Their{" "}
            {summary.orderCount === 1 ? "order" : `${summary.orderCount} orders`} stay in the
            system under their name. This cannot be undone.
          </>
        }
        confirmLabel="Yes, remove them"
        busy={working}
        onConfirm={runDelete}
      />
    </Page>
  );
}
