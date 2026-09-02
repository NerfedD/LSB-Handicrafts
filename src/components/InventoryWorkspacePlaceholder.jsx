import { Box, LayoutDashboard, Package, ShoppingCart, Truck } from "./icons";
import ManagementShell from "./layout/ManagementShell";
import { QuickAction, QuickActionsCard } from "./shared/DashboardCards";
import { Card } from "@/components/ui/card";

/**
 * Stand-in for the inventory / deliveries / orders workspace while it's being
 * rebuilt.
 *
 * The old workspace (components/AdminDashboard.jsx, its dark layout/Sidebar and
 * the whole views/ tree) is still on disk but no longer routed — App.jsx's
 * "workspace" view key points here instead. It was the last screen still using
 * the pre-Figma chrome: its own dark sidebar hardcoded "System Admin / Davao
 * City" for whoever opened it, and it took no `profile`, so every role saw the
 * same admin-looking shell.
 *
 * This uses ManagementShell like every other current screen (Figma #13-#24), so
 * the sidebar shows the real signed-in person and hides the admin-only items
 * from non-Admins on its own — see the NAV_ITEMS filter in layout/ManagementShell.
 * SECTION_OF there already maps "workspace" onto the Dashboard nav item, so that
 * entry stays lit while this is open.
 */

const MODULES = [
  {
    Icon: Package,
    label: "Inventory",
    description: "Stock levels, SKUs and low-stock thresholds.",
  },
  {
    Icon: Truck,
    label: "Deliveries",
    description: "Delivery records and their status.",
  },
  {
    Icon: ShoppingCart,
    label: "Orders",
    description: "Customer orders and reserved stock.",
  },
];

export default function InventoryWorkspacePlaceholder({
  profile,
  onNavigate,
  onSignOut,
}) {
  return (
    <ManagementShell
      active="workspace"
      title="Inventory Workspace"
      subtitle="Inventory, deliveries and orders"
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 className="text-[24px] font-bold leading-9 tracking-[-0.48px] text-[#17263a]">
          This workspace is still being built.
        </h2>
        <p className="pt-1 text-[14.5px] text-[#5f6875]">
          It&rsquo;s being rebuilt to match the rest of the system. Nothing has
          been deleted &mdash; existing inventory, delivery and order records are
          untouched.
        </p>

        <Card className="mt-7">
          <div className="flex flex-col items-center justify-center px-8 pb-10 pt-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#1746d10f]">
              <Box className="h-6 w-6 text-[#1746d1]" />
            </div>
            <p className="pt-5 text-[17px] font-bold tracking-[-0.17px] text-[#17263a]">
              Work in progress
            </p>
            <p className="max-w-[420px] pt-2 text-[13px] leading-[1.6] text-[#5f6875]">
              The three sections below will live here once the rebuild lands.
              Until then, use the Product / Item Profiles screen in the sidebar
              for the product catalog.
            </p>
          </div>

          <div className="grid grid-cols-1 border-t border-[#17263a0f] sm:grid-cols-3">
            {MODULES.map((module, index) => {
              // Lifted to a const rather than destructured in the parameter
              // list: no-unused-vars can't see JSX usage here (the project
              // doesn't install eslint-plugin-react) and its varsIgnorePattern
              // exemption for capitalised names covers variables, not
              // arguments. Same dance as layout/ManagementShell.
              const Icon = module.Icon;
              return (
                <div
                  key={module.label}
                  className={`px-6 py-5 ${
                    index > 0
                      ? "border-t border-[#17263a0f] sm:border-l sm:border-t-0"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#17263a0a]">
                      <Icon className="h-[15px] w-[15px] text-[#5f6875]" />
                    </span>
                    <p className="text-[13.5px] font-semibold text-[#17263a]">
                      {module.label}
                    </p>
                  </div>
                  <p className="pt-2 text-[12.5px] leading-[1.55] text-[#5f6875]">
                    {module.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#9a610014] px-2.5 py-[3px] text-[11.5px] font-semibold text-[#8a5600]">
                    <span className="size-[5px] rounded-full bg-[#8a5600]" />
                    Coming soon
                  </span>
                </div>
              );
            })}
          </div>

          <p className="border-t border-[#17263a0f] bg-[#fafaf8] px-5 py-3 text-[12px] text-[#5f6875]/60">
            3 sections planned
          </p>
        </Card>

        <div className="mt-5">
          <QuickActionsCard>
            <QuickAction
              primary
              icon={<LayoutDashboard className="h-[15px] w-[15px]" />}
              label="Back to Dashboard"
              onClick={() => onNavigate("dashboard")}
            />
            <QuickAction
              icon={<Box className="h-[15px] w-[15px]" />}
              label="View Products"
              onClick={() => onNavigate("products")}
            />
          </QuickActionsCard>
        </div>
      </div>
    </ManagementShell>
  );
}
