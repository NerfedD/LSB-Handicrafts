import { Calendar, Truck } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import {
  DetailBackLink,
  DetailCard,
  DetailField,
  DetailHeaderCard,
} from "../shared/ProfileDetail";
import { ProfileNotFound } from "../shared/ProfilePanels";
import { formatLongDate } from "../../utils/profileFormat";

/**
 * LSB Handicrafts — Supplier Details
 * Figma: Screen #21, nodes 184:4992 (record), 184:5233 (record not found)
 */
export default function SupplierDetailPage({
  supplier,
  profile,
  onNavigate,
  onSignOut,
  onBack,
  onEdit,
}) {
  return (
    <ManagementShell
      active="supplier-detail"
      title="Supplier Details"
      subtitle="Supplier Profiles / Supplier Details"
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[860px]">
        {!supplier ? (
          <ProfileNotFound label="Supplier" onBack={onBack} />
        ) : (
          <>
            <DetailBackLink label="Supplier Profiles" onClick={onBack} />

            <DetailHeaderCard
              badge={
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#17263a] text-white">
                  <Truck className="h-6 w-6" />
                </span>
              }
              eyebrow="Supplier Profile"
              title={supplier.name}
              meta={
                supplier.contactPerson ? (
                  <>
                    Contact:{" "}
                    <span className="font-semibold text-[#17263a]">
                      {supplier.contactPerson}
                    </span>
                  </>
                ) : null
              }
              editLabel="Edit Supplier"
              onEdit={() => onEdit(supplier.id)}
              backLabel="Back to Supplier List"
              onBack={onBack}
            />

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailCard
                icon={<Truck className="h-4 w-4" />}
                title="Supplier Information"
              >
                <div className="space-y-4">
                  <DetailField label="Supplier Name">{supplier.name}</DetailField>
                  <DetailField label="Contact Person">
                    {supplier.contactPerson}
                  </DetailField>
                  <DetailField label="Contact Number">
                    {supplier.contactNumber}
                  </DetailField>
                  <DetailField label="Email Address">{supplier.email}</DetailField>
                  <DetailField label="Address">{supplier.address}</DetailField>
                </div>
              </DetailCard>

              <DetailCard
                icon={<Calendar className="h-4 w-4" />}
                title="Record Information"
              >
                <div className="space-y-4">
                  <DetailField label="Date Added">
                    {formatLongDate(supplier.createdAt)}
                  </DetailField>
                  <DetailField label="Last Updated">
                    {formatLongDate(supplier.updatedAt)}
                  </DetailField>
                </div>
              </DetailCard>
            </div>
          </>
        )}
      </div>
    </ManagementShell>
  );
}
