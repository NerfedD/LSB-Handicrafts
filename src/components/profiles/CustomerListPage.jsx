import { useMemo, useState } from "react";
import { UserRound } from "../icons";
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
 * LSB Handicrafts — Customer Profiles
 * Figma: Screen #14, nodes 164:2 (list), 167:380 (search / no results),
 * 169:901 (no records yet)
 */

const COLUMNS = [
  { key: "name", label: "Customer Name", className: "flex-[1.6]" },
  { key: "contactNumber", label: "Contact Number", className: "w-[130px]" },
  { key: "email", label: "Email", className: "flex-[1.3]" },
  { key: "address", label: "Address", className: "w-[140px]" },
  { key: "updatedAt", label: "Last Updated", className: "w-[110px]" },
  { key: "actions", label: "Actions", className: "w-[112px] text-right" },
];


export default function CustomerListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  customers = [],
  onView,
  onEdit,
  onAdd,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(needle) ||
        String(c.contactNumber || "").toLowerCase().includes(needle)
    );
  }, [customers, query]);

  function renderCell(customer, key) {
    switch (key) {
      case "name":
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ${avatarColorOf(
                customer.name
              )}`}
            >
              {initialsOf(customer.name)}
            </span>
            <span className="truncate text-[13.5px] font-semibold text-[#17263a]">
              {customer.name}
            </span>
          </div>
        );
      case "updatedAt":
        return (
          <span className="text-[12.5px] text-[#5f6875]/75">
            {formatShortDate(customer.updatedAt)}
          </span>
        );
      case "actions":
        return (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onView(customer.id)}
              className={`${rowAction} text-[#1746d1] hover:bg-[#1746d10f]`}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => onEdit(customer.id)}
              className={`${rowAction} text-[#17263a] hover:bg-[#17263a0a]`}
            >
              Edit
            </button>
          </div>
        );
      default:
        return (
          <span className="block truncate text-[12.5px] text-[#5f6875]">
            {customer[key] || "—"}
          </span>
        );
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1160px]">
      <ProfileSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search customers by name or contact number"
        resultCount={filtered.length}
        addLabel="Add Customer"
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
            icon={<UserRound className="h-5 w-5" />}
            title="customer"
            description="Add a customer profile to begin managing customer information."
            query={query.trim()}
            onClearSearch={() => setQuery("")}
            addLabel="Add Customer"
            onAdd={onAdd}
          />
        ) : (
          <ProfileTable
            columns={COLUMNS}
            rows={filtered}
            rowKey={(customer) => customer.id}
            renderCell={renderCell}
            footer={`${filtered.length} ${
              filtered.length === 1 ? "customer" : "customers"
            } total`}
          />
        )}
      </div>
    </div>
  );
}
