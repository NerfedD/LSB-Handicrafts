import { useMemo, useState } from "react";
import { Box } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import ProfileSearchBar from "../shared/ProfileSearchBar";
import ProfileTable from "../shared/ProfileTable";
import StatusPill from "../shared/StatusPill";
import { ProfileEmptyState } from "../shared/ProfilePanels";
import { formatPeso } from "../../utils/profileFormat";
import { formatDimensions, formatProductType } from "../../utils/productFormat";
import { stockFor, stockIndex } from "../../utils/productStock";

/**
 * LSB Handicrafts — Product / Item Profiles
 * Figma: Screen #17, nodes 172:2044 (list), 172:2442 / 172:2681 (search),
 * 172:2851 (no records yet)
 *
 * Distinct from the dashboard workspace's Inventory screen: this is the
 * catalog entry (item code, size, price, low-stock threshold), not stock on
 * hand. See the `products` table in supabase/schema.sql.
 */

const COLUMNS = [
  { key: "itemCode", label: "Item Code", className: "w-[92px]" },
  { key: "name", label: "Product Name", className: "flex-[1.7]" },
  { key: "productType", label: "Type", className: "w-[92px]" },
  { key: "size", label: "Size", className: "w-[120px]" },
  { key: "unitPrice", label: "Unit Price", className: "w-[100px]" },
  { key: "stock", label: "In Stock", className: "w-[112px]" },
  { key: "lowStockThreshold", label: "Low-Stock Threshold", className: "w-[124px]" },
  { key: "status", label: "Status", className: "w-[100px]" },
  { key: "actions", label: "Actions", className: "w-[112px] text-right" },
];

const rowAction =
  "rounded-md border border-[#17263a26] px-2.5 py-1 text-[12px] font-semibold transition";

export default function ProductListPage({
  products = [],
  inventory = [],
  profile,
  onNavigate,
  onSignOut,
  onView,
  onEdit,
  onAdd,
}) {
  const [query, setQuery] = useState("");

  // Built once per render rather than per row — renderCell runs for every
  // product and rebuilding the map each time would be quadratic.
  const stockByCode = useMemo(() => stockIndex(inventory), [inventory]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(needle) ||
        String(p.itemCode || "").toLowerCase().includes(needle)
    );
  }, [products, query]);

  function renderCell(product, key) {
    switch (key) {
      case "itemCode":
        return (
          <span className="text-[12.5px] font-semibold text-[#5f6875]">
            {product.itemCode}
          </span>
        );
      case "name":
        return (
          <span className="block truncate text-[13.5px] font-semibold text-[#17263a]">
            {product.name}
          </span>
        );
      case "productType":
        return (
          <span className="block truncate text-[12.5px] text-[#5f6875]">
            {formatProductType(product.productType)}
          </span>
        );
      // Rendered from the dimension columns rather than the stored `size`
      // label, so a row stays right even if the label was written by an older
      // version of the form.
      case "size":
        return (
          <span className="block truncate text-[12.5px] text-[#5f6875]">
            {formatDimensions(product)}
          </span>
        );
      case "unitPrice":
        return (
          <span className="text-[13px] font-semibold text-[#17263a]">
            {formatPeso(product.unitPrice)}
          </span>
        );
      // Stock lives in the inventory table, not here — see utils/productStock.
      // "Not tracked" is shown as a dash rather than 0, because a product with
      // no inventory row isn't out of stock, it's unknown.
      case "stock": {
        const stock = stockFor(product, stockByCode);
        if (!stock.tracked) {
          return (
            <span className="text-[12.5px] text-[#9aa3ad]" title="No matching inventory record">
              Not tracked
            </span>
          );
        }
        const tone = stock.isOut
          ? "text-[#b54747]"
          : stock.isLow
            ? "text-[#8a5600]"
            : "text-[#17263a]";
        return (
          <span className={`text-[12.5px] font-semibold ${tone}`}>
            {stock.available}
            {stock.reserved > 0 && (
              <span className="block text-[11px] font-normal text-[#5f6875]">
                {stock.onHand} on hand
              </span>
            )}
          </span>
        );
      }
      case "lowStockThreshold":
        return (
          <span className="text-[12.5px] text-[#5f6875]">
            {product.lowStockThreshold ?? "—"} units
          </span>
        );
      case "status":
        return <StatusPill status={product.status} />;
      case "actions":
        return (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onView(product.id)}
              className={`${rowAction} text-[#1746d1] hover:bg-[#1746d10f]`}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => onEdit(product.id)}
              className={`${rowAction} text-[#17263a] hover:bg-[#17263a0a]`}
            >
              Edit
            </button>
          </div>
        );
      default:
        return (
          <span className="block truncate text-[12.5px] text-[#5f6875]">
            {product[key] || "—"}
          </span>
        );
    }
  }

  return (
    <ManagementShell
      active="products"
      title="Product / Item Profiles"
      subtitle="Dashboard / Product / Item Profiles"
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <ProfileSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search products by name or item code"
          resultCount={filtered.length}
          addLabel="Add Product"
          onAdd={onAdd}
        />

        <div className="pt-6">
          {filtered.length === 0 ? (
            <ProfileEmptyState
              icon={<Box className="h-5 w-5" />}
              title="product"
              description="Add a product or item profile to begin managing the product catalog."
              query={query.trim()}
              onClearSearch={() => setQuery("")}
              addLabel="Add Product"
              onAdd={onAdd}
            />
          ) : (
            <ProfileTable
              columns={COLUMNS}
              rows={filtered}
              rowKey={(product) => product.id}
              renderCell={renderCell}
              footer={`${filtered.length} ${
                filtered.length === 1 ? "product" : "products"
              } in catalog`}
            />
          )}
        </div>
      </div>
    </ManagementShell>
  );
}
