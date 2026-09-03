import { Calendar, MapPin, Phone } from "../icons";
import {
  DetailBackLink,
  DetailCard,
  DetailField,
  DetailHeaderCard,
} from "../shared/ProfileDetail";
import { ProfileNotFound } from "../shared/ProfilePanels";
import { avatarColorOf } from "../shared/avatarColors";
import { initialsOf } from "../../utils/staffData";
import { formatLongDate } from "../../utils/profileFormat";

/**
 * LSB Handicrafts — Customer Details
 * Figma: Screen #15, nodes 169:533 (record), 169:766 (record not found)
 *
 * `customer` is undefined when the selected row has gone away (deleted in
 * Supabase, or a stale selection after a reload) — that's the not-found state,
 * not a crash.
 */
export default function CustomerDetailPage({
  customer,
  onBack,
  onEdit,
}) {
  return (
    <div className="mx-auto w-full max-w-[860px]">
      {!customer ? (
        <ProfileNotFound label="Customer" onBack={onBack} />
      ) : (
        <>
          <DetailBackLink label="Customer Profiles" onClick={onBack} />

          <DetailHeaderCard
            badge={
              <span
                className={`flex size-14 shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white ${avatarColorOf(
                  customer.name
                )}`}
              >
                {initialsOf(customer.name)}
              </span>
            }
            eyebrow="Customer Profile"
            title={customer.name}
            meta={`Customer ID #${String(customer.id).padStart(4, "0")}`}
            editLabel="Edit Customer"
            onEdit={() => onEdit(customer.id)}
            backLabel="Back to Customer List"
            onBack={onBack}
          />

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <DetailCard
              icon={<Phone className="h-4 w-4" />}
              title="Contact Information"
            >
              <div className="space-y-4">
                <DetailField label="Contact Number">
                  {customer.contactNumber}
                </DetailField>
                <DetailField label="Email Address">
                  {customer.email}
                </DetailField>
              </div>
            </DetailCard>

            <DetailCard icon={<MapPin className="h-4 w-4" />} title="Address">
              <DetailField label="Complete Address">
                {customer.address}
              </DetailField>
            </DetailCard>
          </div>

          <DetailCard
            className="mt-5"
            icon={<Calendar className="h-4 w-4" />}
            title="Record Information"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailField label="Customer ID">
                #{String(customer.id).padStart(4, "0")}
              </DetailField>
              <DetailField label="Date Added">
                {formatLongDate(customer.createdAt)}
              </DetailField>
              <DetailField label="Last Updated">
                {formatLongDate(customer.updatedAt)}
              </DetailField>
            </div>
          </DetailCard>
        </>
      )}
    </div>
  );
}
