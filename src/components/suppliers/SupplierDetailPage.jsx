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
  canDelete = false,
  onBack,
  onEdit,
  onDelete,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

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
      {canDelete && (
        <DangerBlock
          title="Remove this supplier for good"
          action={
            <Button variant="danger" size="lg" onClick={() => setConfirming(true)}>
              Remove {supplier.name}
            </Button>
          }
        >
          {supplier.name} disappears from the suppliers list, along with their contact
          person, phone number and address. Orders and stock records are not touched —
          nothing in the system points at a supplier — so nothing else changes. This
          cannot be undone.
          <br />
          <br />
          If you have simply stopped buying from them, leaving the record alone costs
          nothing and keeps their number to hand if you go back.
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
