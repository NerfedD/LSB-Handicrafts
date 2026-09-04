import { ArrowLeft, AtSign, Calendar, Handshake, MapPin, Pencil, Phone, UserRound } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import IconChip from "../shared/Chip";
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
 */
export default function SupplierDetailPage({ supplier, onBack, onEdit }) {
  if (!supplier) return <NotFoundState noun="supplier" onBack={onBack} />;

  const dialable = String(supplier.contactNumber || "").replace(/[^\d+]/g, "");

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
    </div>
  );
}
