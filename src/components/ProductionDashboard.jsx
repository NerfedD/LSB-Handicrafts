import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  MinusCircle,
  Plus,
  Search,
} from "./icons";
import ManagementShell from "./layout/ManagementShell";
import {
  Panel,
  PanelEmptyState,
  QuickAction,
  QuickActionsCard,
  StatCard,
} from "./shared/DashboardCards";
import { greeting } from "../utils/profileFormat";
import {
  ACTIVITY_PILL_STYLES,
  activityFrom,
  relativeDay,
} from "../utils/recordActivity";
import { availableOf } from "../utils/stockLedger";

/**
 * LSB Handicrafts — Production Staff Dashboard
 * Figma: Screen #24, node 190:7082 (populated) / 190:7477 (empty)
 *
 * Production's view is the catalog: how many items exist, which are live, and
 * which are running out.
 *
 * That last one needs a join. The `products` catalog carries a
 * low_stock_threshold but no stock — stock lives in `inventory`, a separate
 * table owned by a different role. They line up on code (products.itemCode ==
 * inventory.sku), so the panel matches them there and quietly skips any catalog
 * entry with no stock row to compare against, rather than reporting a product
 * with no stock record as being out of stock.
 */

const PANEL_ROWS = 5;

/**
 * Catalog entries whose matching inventory row has fallen to or below its
 * threshold. Availability (on hand minus what pending orders have reserved) is
 * what matters here, not the raw shelf count.
 */
function nearLowStock(products, inventory) {
  const bySku = new Map(
    inventory.map((item) => [String(item.sku || "").toLowerCase(), item])
  );

  return products
    .map((product) => {
      const stockRow = bySku.get(String(product.itemCode || "").toLowerCase());
      if (!stockRow) return null;

      const available = availableOf(stockRow);
      const threshold = Number(
        stockRow.lowStockThreshold ?? product.lowStockThreshold ?? 0
      );
      if (available > threshold) return null;

      return {
        id: product.id,
        itemCode: product.itemCode,
        name: product.name,
        available,
        threshold,
        isOut: available <= 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.available - b.available);
}

export default function ProductionDashboard({
  products = [],
  inventory = [],
  profile,
  onNavigate,
  onSignOut,
  onAddProduct,
}) {
  const productActivity = useMemo(
    () => activityFrom(products, "product", (p) => p.itemCode),
    [products]
  );

  const counts = useMemo(
    () => ({
      total: products.length,
      active: products.filter((p) => p.status === "Active").length,
      inactive: products.filter((p) => p.status !== "Active").length,
    }),
    [products]
  );

  const lowStock = useMemo(
    () => nearLowStock(products, inventory),
    [products, inventory]
  );

  return (
    <ManagementShell
      active="dashboard"
      title="Dashboard"
      subtitle="Overview of your production workspace."
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 className="text-[24px] font-bold leading-9 tracking-[-0.48px] text-[#17263a]">
          {greeting()}, {profile?.name?.split(" ")[0] || "there"}.
        </h2>
        <p className="pt-1 text-[14.5px] text-[#5f6875]">
          Here&rsquo;s your production workspace overview.
        </p>

        <div className="grid grid-cols-1 gap-4 pt-7 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Box className="h-5 w-5 text-[#1b3a6b]" />}
            tone="bg-[#1b3a6b14]"
            value={counts.total}
            label="Total Products"
            description="All product and item profiles"
            onView={() => onNavigate("products")}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-[#287a55]" />}
            tone="bg-[#287a5517]"
            value={counts.active}
            label="Active Products"
            description="Currently active in system"
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-[#8a5600]" />}
            tone="bg-[#9a610014]"
            value={lowStock.length}
            label="Near Low-Stock"
            description="Items near stock threshold"
          />
          <StatCard
            icon={<MinusCircle className="h-5 w-5 text-[#5f6875]" />}
            tone="bg-[#17263a0d]"
            value={counts.inactive}
            label="Inactive Products"
            description="Not currently active"
          />
        </div>

        <div className="pt-5">
          <QuickActionsCard>
            <QuickAction
              icon={<Box className="h-[15px] w-[15px]" />}
              label="View Products"
              onClick={() => onNavigate("products")}
            />
            <QuickAction
              primary
              icon={<Plus className="h-[15px] w-[15px]" />}
              label="Add Product"
              onClick={onAddProduct}
            />
            <QuickAction
              icon={<Search className="h-[15px] w-[15px]" />}
              label="Search Products"
              onClick={() => onNavigate("products")}
            />
          </QuickActionsCard>
        </div>

        <div className="grid grid-cols-1 gap-5 pt-5 lg:grid-cols-2">
          <Panel
            title="Recent Product Activity"
            icon={<Activity className="h-4 w-4 text-[#5f6875]" />}
            onViewAll={() => onNavigate("products")}
            footer={`${products.length} ${
              products.length === 1 ? "product" : "products"
            } total`}
          >
            {productActivity.length === 0 ? (
              <PanelEmptyState
                title="No recent product activity"
                description="Product activity will appear here when product records are added or updated."
              />
            ) : (
              productActivity.slice(0, PANEL_ROWS).map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3.5 px-5 py-3 ${
                    index > 0 ? "border-t border-[#17263a0d]" : ""
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#17263a0a]">
                    <Box className="h-[15px] w-[15px] text-[#5f6875]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-[#17263a]">
                      <span className="font-semibold">{entry.name}</span>
                      <span className="font-medium"> — {entry.action}</span>
                    </p>
                    <p className="pt-0.5 text-[12px] text-[#5f6875]">
                      {entry.subtitle ? `${entry.subtitle} · ` : ""}
                      {relativeDay(entry.when)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold tracking-[0.115px] ${
                      ACTIVITY_PILL_STYLES[entry.kind]
                    }`}
                  >
                    {entry.kind}
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel
            title="Near Low-Stock"
            icon={<AlertTriangle className="h-4 w-4 text-[#8a5600]" />}
            onViewAll={() => onNavigate("products")}
            footer={
              lowStock.length === 0
                ? "Nothing to watch"
                : `${lowStock.length} ${
                    lowStock.length === 1 ? "item" : "items"
                  } to watch`
            }
          >
            {lowStock.length === 0 ? (
              <PanelEmptyState
                title="Nothing running low"
                description="Products fall into this list when their stock drops to the low-stock threshold."
              />
            ) : (
              <>
                <div className="flex items-center gap-4 bg-[#fafaf8] px-5 py-2.5">
                  <span className="w-[76px] text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                    Code
                  </span>
                  <span className="flex-1 text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                    Product
                  </span>
                  <span className="w-[124px] text-right text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                    Status
                  </span>
                </div>
                {lowStock.slice(0, PANEL_ROWS).map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-3 ${
                      index > 0 ? "border-t border-[#17263a0d]" : ""
                    }`}
                  >
                    <span className="w-[76px] font-mono text-[11.5px] text-[#5f6875]">
                      {item.itemCode}
                    </span>
                    <span className="flex-1 truncate text-[13.5px] text-[#17263a]">
                      {item.name}
                    </span>
                    <span className="w-[124px] text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${
                          item.isOut
                            ? "bg-[#b5474714] text-[#b54747]"
                            : "bg-[#9a610014] text-[#8a5600]"
                        }`}
                      >
                        <span
                          className={`size-[5px] rounded-full ${
                            item.isOut ? "bg-[#b54747]" : "bg-[#8a5600]"
                          }`}
                        />
                        {item.isOut ? "Out of Stock" : "Near Threshold"}
                      </span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </Panel>
        </div>
      </div>
    </ManagementShell>
  );
}
