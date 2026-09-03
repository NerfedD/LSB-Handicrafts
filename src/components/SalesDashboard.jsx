import { useMemo } from "react";
import { Activity, Box, Truck, UserPlus, UserRound, Users } from "./icons";
import {
  Panel,
  PanelEmptyState,
  QuickAction,
  QuickActionsCard,
  StatCard,
} from "./shared/DashboardCards";
import { avatarColorOf } from "./shared/avatarColors";
import { initialsOf } from "../utils/staffData";
import { greeting } from "../utils/profileFormat";
import {
  ACTIVITY_PILL_STYLES,
  activityFrom,
  changedToday,
  relativeDay,
} from "../utils/recordActivity";

/**
 * LSB Handicrafts — Cashier / Sales Staff Dashboard
 * Figma: Screen #23, node 188:6365 (populated) / 188:6780 (empty)
 *
 * The sales-facing landing screen: who the customers are, what's on the shelf,
 * and who supplies it. Everything is derived from the customer / product /
 * supplier records App.jsx already holds — see utils/recordActivity for how the
 * two activity panels are read off each record's own timestamps.
 */

const PANEL_ROWS = 5;

function ActivityRow({ entry, index }) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3 ${
        index > 0 ? "border-t border-[#17263a0d]" : ""
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColorOf(
          entry.name
        )}`}
      >
        {initialsOf(entry.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-[#17263a]">
          <span className="font-semibold">{entry.name}</span>
          <span className="font-medium"> — {entry.action}</span>
        </p>
        <p className="pt-1 text-[12px] text-[#5f6875]">{relativeDay(entry.when)}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold tracking-[0.115px] ${
          ACTIVITY_PILL_STYLES[entry.kind]
        }`}
      >
        {entry.kind}
      </span>
    </div>
  );
}

export default function SalesDashboard({
  customers = [],
  products = [],
  suppliers = [],
  profile,
  onNavigate,
  onAddCustomer,
}) {
  const customerActivity = useMemo(
    () => activityFrom(customers, "customer"),
    [customers]
  );
  const supplierActivity = useMemo(
    () => activityFrom(suppliers, "supplier"),
    [suppliers]
  );

  // "Events recorded today" spans both feeds — it's the whole workspace's
  // activity for the day, not one panel's.
  const eventsToday = useMemo(
    () =>
      [...customers, ...suppliers, ...products].filter(changedToday).length,
    [customers, suppliers, products]
  );

  return (
    <div className="mx-auto w-full max-w-[1160px]">
      <h2 className="text-[24px] font-bold leading-9 tracking-[-0.48px] text-[#17263a]">
        {greeting()}, {profile?.name?.split(" ")[0] || "there"}.
      </h2>
      <p className="pt-1 text-[14.5px] text-[#5f6875]">
        Here&rsquo;s your workspace overview.
      </p>

      <div className="grid grid-cols-1 gap-4 pt-7 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<UserRound className="h-5 w-5 text-[#1b3a6b]" />}
          tone="bg-[#1b3a6b14]"
          value={customers.length}
          label="Customers"
          description="Total registered customers"
          onView={() => onNavigate("customers")}
        />
        <StatCard
          icon={<Box className="h-5 w-5 text-[#653eb5]" />}
          tone="bg-[#653eb514]"
          value={products.length}
          label="Products"
          description="Products and items on file"
          onView={() => onNavigate("products")}
        />
        <StatCard
          icon={<Truck className="h-5 w-5 text-[#166b59]" />}
          tone="bg-[#166b5914]"
          value={suppliers.length}
          label="Suppliers"
          description="Registered suppliers"
          onView={() => onNavigate("suppliers")}
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-[#8a5600]" />}
          tone="bg-[#9a610014]"
          value={eventsToday}
          label="Recent Activity"
          description="Events recorded today"
        />
      </div>

      <div className="pt-5">
        <QuickActionsCard>
          <QuickAction
            primary
            icon={<UserPlus className="h-4 w-4" />}
            label="Add Customer"
            onClick={onAddCustomer}
          />
          <QuickAction
            icon={<Users className="h-4 w-4" />}
            label="View Customers"
            onClick={() => onNavigate("customers")}
          />
          <QuickAction
            icon={<Box className="h-4 w-4" />}
            label="View Products"
            onClick={() => onNavigate("products")}
          />
          <QuickAction
            icon={<Truck className="h-4 w-4" />}
            label="View Suppliers"
            onClick={() => onNavigate("suppliers")}
          />
        </QuickActionsCard>
      </div>

      <div className="grid grid-cols-1 gap-5 pt-5 lg:grid-cols-2">
        <Panel
          title="Recent Customer Activity"
          icon={<UserRound className="h-4 w-4 text-[#5f6875]" />}
          onViewAll={() => onNavigate("customers")}
          footer={`${customers.length} ${
            customers.length === 1 ? "customer" : "customers"
          } total`}
        >
          {customerActivity.length === 0 ? (
            <PanelEmptyState
              title="No recent activity"
              description="Customer activity will appear here when records are added or updated."
            />
          ) : (
            customerActivity
              .slice(0, PANEL_ROWS)
              .map((entry, index) => (
                <ActivityRow key={entry.id} entry={entry} index={index} />
              ))
          )}
        </Panel>

        <Panel
          title="Recent Supplier Activity"
          icon={<Truck className="h-4 w-4 text-[#5f6875]" />}
          onViewAll={() => onNavigate("suppliers")}
          footer={`${suppliers.length} ${
            suppliers.length === 1 ? "supplier" : "suppliers"
          } total`}
        >
          {supplierActivity.length === 0 ? (
            <PanelEmptyState
              title="No recent activity"
              description="Supplier activity will appear here when records are added or updated."
            />
          ) : (
            supplierActivity
              .slice(0, PANEL_ROWS)
              .map((entry, index) => (
                <ActivityRow key={entry.id} entry={entry} index={index} />
              ))
          )}
        </Panel>
      </div>
    </div>
  );
}
