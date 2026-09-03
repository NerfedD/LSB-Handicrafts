import { useMemo, useState } from "react";
import { Truck } from "../icons";
import ProfileSearchBar from "../shared/ProfileSearchBar";
import ProfileTable from "../shared/ProfileTable";
import {
  ProfileEmptyState,
  ProfileLoadingState,
  ProfileErrorState,
} from "../shared/ProfilePanels";
import { avatarColorOf } from "../shared/avatarColors";
import { initialsOf } from "../../utils/staffData";
import { formatShortDate } from "../../utils/profileFormat";
import { rowAction } from "../shared/profileButtonStyles";

/**
 * LSB Handicrafts — Supplier Profiles
 * Figma: Screen #20, nodes 179:4060 (list), 179:4417 / 179:4659 (search),
 * 179:4826 (no records yet)
 */

const COLUMNS = [
  { key: "name", label: "Supplier Name", className: "flex-[1.6]" },
  { key: "contactPerson", label: "Contact Person", className: "w-[130px]" },
  { key: "contactNumber", label: "Contact Number", className: "w-[126px]" },
  { key: "email", label: "Email", className: "flex-[1.3]" },
  { key: "address", label: "Address", className: "w-[130px]" },
  { key: "updatedAt", label: "Last Updated", className: "w-[110px]" },
  { key: "actions", label: "Actions", className: "w-[112px] text-right" },
];


export default function SupplierListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  suppliers = [],
  onView,
  onEdit,
  onAdd,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter(
      (s) =>
        String(s.name || "").toLowerCase().includes(needle) ||
        String(s.contactNumber || "").toLowerCase().includes(needle)
    );
  }, [suppliers, query]);

  function renderCell(supplier, key) {
    switch (key) {
      case "name":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[9.5px] font-bold text-white ${avatarColorOf(
                supplier.name
              )}`}
            >
              {initialsOf(supplier.name)}
            </span>
            <span className="truncate text-[13.5px] font-semibold text-[#17263a]">
              {supplier.name}
            </span>
          </div>
        );
      case "updatedAt":
        return (
          <span className="text-[12.5px] text-[#5f6875]/75">
            {formatShortDate(supplier.updatedAt)}
          </span>
        );
      case "actions":
        return (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onView(supplier.id)}
              className={`${rowAction} text-[#1746d1] hover:bg-[#1746d10f]`}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => onEdit(supplier.id)}
              className={`${rowAction} text-[#17263a] hover:bg-[#17263a0a]`}
            >
              Edit
            </button>
          </div>
        );
      default:
        return (
          <span className="block truncate text-[12.5px] text-[#5f6875]">
            {supplier[key] || "—"}
          </span>
        );
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1160px]">
      <ProfileSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search suppliers by name or contact number"
        resultCount={filtered.length}
        addLabel="Add Supplier"
        onAdd={onAdd}
      />

      <div className="pt-6">
        {/* Three distinct states, not one. Loading is a skeleton, a failed
            read offers a retry, and only a genuinely empty result gets the
            empty panel. */}
        {loadError ? (
          <ProfileErrorState onRetry={onRetry} />
        ) : !isLoaded ? (
          <ProfileLoadingState />
        ) : filtered.length === 0 ? (
          <ProfileEmptyState
            icon={<Truck className="h-5 w-5" />}
            title="supplier"
            description="Add a supplier profile to begin managing supplier information."
            query={query.trim()}
            onClearSearch={() => setQuery("")}
            addLabel="Add Supplier"
            onAdd={onAdd}
          />
        ) : (
          <ProfileTable
            columns={COLUMNS}
            rows={filtered}
            rowKey={(supplier) => supplier.id}
            renderCell={renderCell}
            footer={`${filtered.length} ${
              filtered.length === 1 ? "supplier" : "suppliers"
            } total`}
          />
        )}
      </div>
    </div>
  );
}
