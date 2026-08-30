import { useMemo, useState } from "react";
import { UserRound } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import ProfileSearchBar from "../shared/ProfileSearchBar";
import ProfileTable from "../shared/ProfileTable";
import { ProfileEmptyState } from "../shared/ProfilePanels";
import { avatarColorOf } from "../shared/avatarColors";
import { initialsOf } from "../../utils/staffData";
import { formatShortDate } from "../../utils/profileFormat";

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

const rowAction =
  "rounded-md border border-[#17263a26] px-2.5 py-1 text-[12px] font-semibold transition";

export default function CustomerListPage({
  customers = [],
  profile,
  onNavigate,
  onSignOut,
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
          <div className="flex min-w-0 items-center gap-2.5">
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
    <ManagementShell
      active="customers"
      title="Customer Profiles"
      subtitle="Manage customer information and contact details."
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
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
          {filtered.length === 0 ? (
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
    </ManagementShell>
  );
}
