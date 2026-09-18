import { useState } from "react";

import { ArrowLeft, AtSign, Calendar, Handshake, MapPin, Pencil, Phone, UserRound } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DangerBlock } from "../shared/Callout";
import IconChip from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import FactTable from "../shared/FactTable";
import { NotFoundState } from "../shared/PageStates";
import { formatLongDate } from "../../utils/profileFormat";

/**
 * One supplier.
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
 * `canDelete` is the UI half of the rule. The other half is the RLS policy on
 * public.suppliers, where DELETE asks for is_admin() — a hidden button is a
 * courtesy, not a permission.
 */
export default function SupplierDetailPage({
  supplier,
  purchaseOrders = [],
  onOpenPurchases,
  canDelete = false,
  onBack,
  onEdit,
  onDelete,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const claimsNeedingReview = purchaseOrders.filter((o) => o.claim_status === 'Needs review').length;
  // Purchasing history is what keeps a supplier on file: the foreign key on
  // raw_material_orders.supplier_id refuses the delete, and this is the client
  // telling somebody that before they reach for the button.
  const blocked = purchaseOrders.length > 0;

  if (!supplier) return <NotFoundState noun="supplier" onBack={onBack} />;

  const dialable = String(supplier.contactNumber || "").replace(/[^\d+]/g, "");

  async function runDelete() {
    setWorking(true);
    await onDelete?.(supplier);
    setWorking(false);
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        All suppliers
      </Button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5.5">
          <div className="flex flex-wrap items-center gap-4">
            <IconChip icon={<Handshake />} tone="clay" size="2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[23px] font-extrabold tracking-[-0.02em] text-ink">
                {supplier.name}
              </h2>
              <p className="pt-1 text-[15.5px] text-muted">
                {supplier.contactPerson
                  ? `Ask for ${supplier.contactPerson}`
                  : "Nobody named as the contact yet"}
                {" · "}
                on record since {formatLongDate(supplier.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-5">
            {dialable && (
              <Button variant="clay" size="lg" asChild>
                <a href={`tel:${dialable}`}>
                  <Phone className="h-5 w-5" />
                  Call {supplier.contactPerson || supplier.name}
                </a>
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => onEdit(supplier.id)}>
              <Pencil className="h-5 w-5" />
              Edit details
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to reach them</CardTitle>
          </CardHeader>
          <FactTable
            rows={[
              {
                label: "Contact person",
                value: supplier.contactPerson || null,
                icon: <UserRound className="h-4.5 w-4.5" />,
              },
              {
                label: "Phone",
                value: supplier.contactNumber || null,
                icon: <Phone className="h-4.5 w-4.5" />,
              },
              {
                label: "Email",
                value: supplier.email || null,
                icon: <AtSign className="h-4.5 w-4.5" />,
              },
              {
                label: "Address",
                value: supplier.address || null,
                icon: <MapPin className="h-4.5 w-4.5" />,
              },
              {
                label: "On record since",
                value: formatLongDate(supplier.createdAt),
                icon: <Calendar className="h-4.5 w-4.5" />,
              },
            ]}
          />
        </Card>
      </div>

      {/* ---- the only place a supplier can be removed ---- */}
      <Card className="p-6 text-[16px]">
        <h2 className="text-[18px] font-extrabold">Raw material purchases</h2>
        <p className="py-3">
          {purchaseOrders.length} supplier {purchaseOrders.length === 1 ? 'order' : 'orders'}
          {' · '}
          {claimsNeedingReview} {claimsNeedingReview === 1 ? 'claim needs' : 'claims need'} review.
        </p>
        <Button variant="outline" size="lg" onClick={onOpenPurchases}>Open supplier deliveries</Button>
      </Card>
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
      {canDelete && (
        <DangerBlock
          title={blocked ? 'This supplier stays on file' : 'Remove this supplier for good'}
          action={
            <Button variant="danger" size="lg" disabled={blocked} onClick={() => setConfirming(true)}>
              Remove {supplier.name}
            </Button>
          }
        >
          {blocked ? (
            <>
              {supplier.name} has purchasing history, so they cannot be removed. Keep the
              contact record: it is what makes their past deliveries and claims traceable
              back to somebody you can ring.
            </>
          ) : (
            <>
              {/* RULE 6 WANTS BOTH HALVES: what goes, and what survives. The
                  "what survives" half went missing when purchasing history was
                  added here, which is what tests/smoke.spec.js caught — and the
                  ConfirmDialog below had gone on saying it, so the two screens
                  of the same decision disagreed.

                  It is still true, and now guaranteed twice: this branch only
                  renders when the supplier has no purchase orders, and
                  raw_material_orders.supplier_id is the only reference to
                  suppliers in the schema — a plain `not null references` with
                  no cascade, so the database refuses the delete rather than
                  taking anything with it. The claim is scoped to THIS supplier
                  for that reason; "nothing references suppliers" is no longer
                  true in general. */}
              {supplier.name} disappears from the suppliers list, along with their contact
              person, phone number and address. Orders and stock records are not touched:
              this supplier has no purchasing history, so nothing else in the system points
              at them. This cannot be undone.
              <br />
              <br />
              {/* Only offered where it is actually a choice. Advising somebody to
                  leave the record alone, under a heading that already says it is
                  staying, is advice about a decision they do not have. */}
              If you have simply stopped buying from them, leaving the record alone costs
              nothing and keeps their number to hand if you go back.
            </>
          )}
        </DangerBlock>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        title={`Remove ${supplier.name}?`}
        consequences={
          <>
            Their contact person, phone number, email and address are deleted with them.
            Orders and stock records stay exactly as they are. This cannot be undone.
          </>
        }
        confirmLabel="Yes, remove them"
        busy={working}
        onConfirm={runDelete}
      />
    </div>
  );
}
