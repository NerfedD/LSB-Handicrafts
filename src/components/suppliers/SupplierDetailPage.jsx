import { useState } from "react";

import { Factory, Pencil, Phone, Truck } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Callout, { DangerBlock } from "../shared/Callout";
import ConfirmDialog from "../shared/ConfirmDialog";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import { Fact, Page, PageHeader, SectionCard, StatCard, StatCards } from "../shared/page";
import { formatLongDate, formatShortDate } from "../../utils/profileFormat";
import { units } from "../../utils/production";

/**
 * One supplier, an app-only screen built from the Suppliers board's side
 * panel and the detail boards' parts.
 *
 * The same shape as one customer — an identity block with the two actions, then
 * a fact table of how to reach them — because the whole point of the shared
 * vocabulary is that somebody who has used one of these screens already knows
 * where things are on the other.
 *
 * The primary action here is calling them, which is why the phone number is a
 * real `tel:` link rather than text to copy out. On the phone this screen is
 * most likely opened on, that is the entire job.
 *
 * REMOVING ONE LIVES AT THE BOTTOM, IN ITS OWN BLOCK, and only an admin sees
 * it — `canDelete`. Rule 6: never a red trash icon in a row, because a
 * row-level icon is an irreversible action sitting a few pixels from "Edit"
 * and gets triggered before it is read. The block names the supplier, says
 * what goes and what stays, and offers the reversible alternative first:
 * almost every "we don't use them any more" is better served by leaving the
 * record alone than by destroying the only copy of their phone number.
 *
 * `canDelete` is the UI half of the rule. The other half is remove_supplier in
 * the database, which only an administrator may call — a hidden button is a
 * courtesy, not a permission. It follows the products' and materials' rule: a
 * supplier with purchase history is kept on file as no longer used (and can be
 * put back), and only one nobody ever ordered from is deleted.
 */
export default function SupplierDetailPage({
  supplier,
  purchaseOrders = [],
  /** Raw materials, to name what this supplier has delivered. */
  materials = [],
  onOpenPurchases,
  canEdit = false,
  canDelete = false,
  onBack,
  onEdit,
  onDelete,
  onRestore,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const claimsNeedingReview = purchaseOrders.filter((o) => o.claim_status === 'Needs review').length;
  // An order still coming is the one thing that stops a removal outright: the
  // delivery has to be received or cancelled first. Purchase history alone only
  // decides what removing means -- kept on file as no longer used, or deleted.
  const stillComing = purchaseOrders.filter((o) => ['Ordered', 'Delivery Scheduled', 'In Transit'].includes(o.status)).length;
  const blocked = stillComing > 0;
  const hasHistory = purchaseOrders.length > 0;
  const archived = supplier?.status === 'Archived';

  // What they supply, as their own purchase orders show it: each material with
  // how much has been ordered and when it last arrived. Derived rather than
  // kept as a separate list, so it cannot disagree with the orders.
  const supplied = [...purchaseOrders.reduce((byMaterial, order) => {
    const entry = byMaterial.get(order.raw_material_id)
      ?? { material: materials.find((m) => m.id === order.raw_material_id), ordered: 0, usable: 0, lastArrived: null };
    if (order.status !== 'Cancelled') entry.ordered += Number(order.quantity_ordered) || 0;
    entry.usable += Number(order.quantity_usable) || 0;
    if (order.actual_delivery_date && (!entry.lastArrived || order.actual_delivery_date > entry.lastArrived)) {
      entry.lastArrived = order.actual_delivery_date;
    }
    return byMaterial.set(order.raw_material_id, entry);
  }, new Map()).values()].filter((entry) => entry.material);

  if (!supplier) return <NotFoundState noun="supplier" onBack={onBack} />;

  const dialable = String(supplier.contactNumber || "").replace(/[^\d+]/g, "");

  async function runDelete() {
    setWorking(true);
    await onDelete?.(supplier);
    setWorking(false);
    setConfirming(false);
  }

  async function runRestore() {
    setWorking(true);
    await onRestore?.(supplier);
    setWorking(false);
  }

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to Suppliers", onClick: onBack }}
        icon={Factory}
        title={supplier.name}
        titleBadge={archived ? <Badge variant="secondary">No longer used</Badge> : null}
        description={
          <>
            {supplier.contactPerson ? `Ask for ${supplier.contactPerson}` : "Nobody named as the contact yet"}
            {" · "}on record since {formatLongDate(supplier.createdAt)}
          </>
        }
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => onEdit(supplier.id)}>
                <Pencil aria-hidden="true" />
                Edit details
              </Button>
            )}
            {dialable && (
              <Button render={<a href={`tel:${dialable}`} />} nativeButton={false}>
                <Phone aria-hidden="true" />
                Call {supplier.contactPerson || supplier.name}
              </Button>
            )}
          </>
        }
      />

      <StatCards label="Their numbers">
        <StatCard label="Supplier orders" value={purchaseOrders.length} caption={`${stillComing} not received yet`} />
        <StatCard label="Materials they supply" value={supplied.length} caption="From their orders" />
        <StatCard
          label="Claims to settle"
          value={claimsNeedingReview}
          badge={claimsNeedingReview > 0 ? <Badge variant="warning" dot>Needs review</Badge> : null}
          caption={claimsNeedingReview > 0 ? "Under Purchasing" : "Nothing open"}
        />
      </StatCards>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title="Raw material purchases"
          action={
            <Button variant="outline" size="sm" onClick={onOpenPurchases}>
              <Truck aria-hidden="true" />
              Open Purchasing
            </Button>
          }
          bodyClassName="p-0"
        >
          {supplied.length === 0 ? (
            <EmptySlot>Nothing ordered from {supplier.name} yet.</EmptySlot>
          ) : (
            <ul className="m-0 list-none p-0">
              {supplied.map(({ material, ordered, usable, lastArrived }) => (
                <li key={material.id} className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-row-divider px-4 py-2 text-13 last:border-b-0">
                  <span className="font-medium">{material.name}</span>
                  <span className="text-muted-fg">
                    {units(ordered, material.unit)} ordered · {units(usable, material.unit)} received usable
                    {lastArrived ? ` · last arrived ${formatShortDate(lastArrived)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="How to reach them">
          <dl className="m-0 flex flex-col gap-3">
            <Fact label="Contact person">{supplier.contactPerson || "Not given"}</Fact>
            <Fact label="Phone">{supplier.contactNumber || "Not given"}</Fact>
            <Fact label="Email">{supplier.email || "Not given"}</Fact>
            <Fact label="Address">{supplier.address || "Not given"}</Fact>
            <Fact label="On record since">{formatLongDate(supplier.createdAt)}</Fact>
          </dl>
        </SectionCard>
      </div>

      {/* ---- the only place a supplier can be removed ---- */}
      {/* THE HEADING HAS TO AGREE WITH THE BUTTON UNDER IT.
          This block used to be headed "Remove this supplier for good" in both
          cases — including the one where the body says the supplier cannot be
          removed and the button below is disabled. A heading that promises an
          action the rest of the block spends two sentences refusing is the
          screen arguing with itself, and the person reading it is the one who
          has to work out which half is true.

          So the whole block states one case at a time. It keeps its position
          and its shape either way, because somebody looking for "where do I
          remove a supplier" should find the same block in the same place and
          be told why they cannot, rather than find nothing at all. */}
      {archived && (
        <Callout
          tone="amber"
          title="No longer used"
          action={canDelete && (
            <Button variant="outline" size="sm" disabled={working} onClick={runRestore}>
              Put them back in use
            </Button>
          )}
        >
          {supplier.name} is not offered for new supplier orders. Their contact details and
          every past order, delivery and claim are unchanged.
        </Callout>
      )}
      {canDelete && !archived && (
        <DangerBlock
          title={blocked ? 'This supplier stays on file' : hasHistory ? 'Stop using this supplier' : 'Remove this supplier for good'}
          action={
            <Button variant="destructive-outline" disabled={blocked} onClick={() => setConfirming(true)}>
              Remove {supplier.name}
            </Button>
          }
        >
          {blocked ? (
            <>
              {supplier.name} has {stillComing} {stillComing === 1 ? 'order' : 'orders'} not received
              yet, so they cannot be removed. Receive or cancel {stillComing === 1 ? 'it' : 'them'} under
              Purchasing first.
            </>
          ) : hasHistory ? (
            <>
              {supplier.name} has purchasing history, so they are kept on file rather than
              deleted: they stop being offered for new supplier orders, and every past order,
              delivery and claim still names them. You can put them back in use at any time.
            </>
          ) : (
            <>
              {/* RULE 6 WANTS BOTH HALVES: what goes, and what survives. This
                  branch only renders when the supplier has no purchase orders,
                  and raw_material_orders.supplier_id is the only reference to
                  suppliers in the schema, so nothing else points at them. */}
              {supplier.name} disappears from the suppliers list, along with their contact
              person, phone number and address. Orders and stock records are not touched:
              this supplier has no purchasing history, so nothing else in the system points
              at them. This cannot be undone.
              {" "}If you have simply stopped buying from them, leaving the record alone costs
              nothing and keeps their number to hand if you go back.
            </>
          )}
        </DangerBlock>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        title={`Remove ${supplier.name}?`}
        consequences={hasHistory ? (
          <>
            They stop being offered for new supplier orders. Their contact details and every
            past order, delivery and claim stay exactly as they are, and they can be put back
            in use.
          </>
        ) : (
          <>
            Their contact person, phone number, email and address are deleted with them.
            Orders and stock records stay exactly as they are. This cannot be undone.
          </>
        )}
        confirmLabel={hasHistory ? "Yes, stop using them" : "Yes, remove them"}
        busy={working}
        onConfirm={runDelete}
      />
    </Page>
  );
}
