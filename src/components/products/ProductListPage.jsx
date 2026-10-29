import { useMemo } from "react";

import useUrlState from "../../hooks/useUrlState";
import useTablePage from "../../hooks/useTablePage";
import { ClipboardText, DotsThree, DownloadSimple, Eye, Package, PencilSimple, Plus, Tag } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mono } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import {
  DataCard,
  EmptyState,
  FilterBar,
  FilterSelect,
  Page,
  PageHeader,
  SearchField,
  StatCard,
  StatCards,
  TablePagination,
  TextLink,
} from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { productIcon } from "../shared/productIcons";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { matches } from "../../utils/search";
import { formatPeso } from "../../utils/profileFormat";
import { needsReorder } from "../../utils/production";
import { shelfItems, stockCounts } from "../../utils/productStock";
import { PRODUCT_TYPE_OPTIONS } from "../../utils/constants";

/**
 * Inventory, drawn to the "5 · Inventory" board:
 *
 *   PageHeader (Stock count, Export, Add product) → four compact StatCards →
 *   a DataCard: FilterBar (search, Kind, stock-level toggles) and the products
 *   table (Product, Code, Kind, On the shelf, Reorder at, Price, Stock, row
 *   actions) → pagination.
 *
 * The app's sort order, "Stock not tracked" and "No longer sold" sit in the
 * same FilterBar, and Categories in the header, built from the same parts.
 */
const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "stock", label: "Fewest first" },
  { value: "price", label: "Cheapest first" },
  { value: "price-desc", label: "Dearest first" },
];

const KIND_OPTIONS = [{ value: "all", label: "All" }, ...PRODUCT_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))];
const KIND_LABEL = Object.fromEntries(PRODUCT_TYPE_OPTIONS.map((option) => [option.value, option.label]));

const LEVEL = {
  in: { label: "In stock", tone: "green" },
  low: { label: "Running low", tone: "amber" },
  out: { label: "Out of stock", tone: "red" },
  untracked: { label: "Not tracked", tone: "neutral" },
};

function stockGroup(stock) {
  if (!stock.tracked) return "untracked";
  if (stock.isOut) return "out";
  if (stock.isLow) return "low";
  return "in";
}

export default function ProductListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  products = [],
  archived = [],
  inventory = [],
  orders = [],
  materials = [],
  batches = [],
  materialsLoaded = false,
  onView,
  onEdit,
  onAdd,
  onStockCount,
  onManageCategories,
  onOpenMaterials,
  onGoToDashboard,
  initialFilter,
  change = null,
}) {
  const [query, setQuery] = useUrlState("query", "", "products");
  const [kind, setKind] = useUrlState("kind", "all", "products");
  const [sort, setSort] = useUrlState("sort", "name", "products");
  const [group, setGroup] = useUrlState("tab", initialFilter ?? "all", "products");

  const showArchived = group === "archived";
  const rows = useMemo(() => shelfItems(showArchived ? archived : products, inventory, orders), [showArchived, archived, products, inventory, orders]);
  const counts = useMemo(() => stockCounts(products, inventory, orders), [products, inventory, orders]);
  const stockValue = useMemo(
    () =>
      shelfItems(products, inventory, orders).reduce(
        (sum, { product, stock }) => sum + (stock.tracked ? Math.max(0, stock.available) * (Number(product.unitPrice) || 0) : 0),
        0
      ),
    [products, inventory, orders]
  );
  const toOrder = useMemo(() => materials.filter((material) => needsReorder(material, batches)).length, [materials, batches]);

  const filtered = useMemo(() => {
    const list = rows.filter(({ product, stock }) => {
      if (!showArchived && group !== "all" && stockGroup(stock) !== group) return false;
      if (kind !== "all" && (product.productType ?? "other") !== kind) return false;
      return matches(query, product.name, product.itemCode, product.size);
    });
    const byName = (a, b) => String(a.product.name).localeCompare(String(b.product.name));
    switch (sort) {
      case "name-desc":
        return [...list].sort((a, b) => byName(b, a));
      case "stock":
        return [...list].sort((a, b) => {
          if (a.stock.tracked !== b.stock.tracked) return a.stock.tracked ? -1 : 1;
          return (a.stock.available ?? 0) - (b.stock.available ?? 0);
        });
      case "price":
        return [...list].sort((a, b) => (a.product.unitPrice ?? 0) - (b.product.unitPrice ?? 0));
      case "price-desc":
        return [...list].sort((a, b) => (b.product.unitPrice ?? 0) - (a.product.unitPrice ?? 0));
      default:
        return [...list].sort(byName);
    }
  }, [rows, group, showArchived, kind, query, sort]);

  const paged = useTablePage(filtered);

  const levels = [
    { value: "all", label: "All", count: counts.all },
    { value: "in", label: "In stock", count: counts.in },
    { value: "low", label: "Running low", count: counts.low },
    { value: "out", label: "Out", count: counts.out },
    ...(counts.untracked > 0 ? [{ value: "untracked", label: "Not tracked", count: counts.untracked }] : []),
    ...(archived.length > 0 ? [{ value: "archived", label: "No longer sold", count: archived.length }] : []),
  ];

  const clearFilters = () => {
    setQuery("");
    setKind("all");
    setGroup("all");
  };

  const exportProducts = () =>
    downloadCsv(
      "lsb-inventory.csv",
      [
        { label: "Product", value: (r) => r.product.name },
        { label: "Code", value: (r) => r.product.itemCode },
        { label: "Kind", value: (r) => KIND_LABEL[r.product.productType] ?? "" },
        { label: "On the shelf", value: (r) => (r.stock.tracked ? r.stock.available : "") },
        { label: "Reorder at", value: (r) => (r.stock.tracked ? r.stock.threshold : "") },
        { label: "Price", value: (r) => r.product.unitPrice },
      ],
      filtered
    );

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="products" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Package}
        title="Inventory"
        description="Finished products on the shelf, ready to sell."
        actions={
          <>
            {onStockCount ? (
              <Button variant="outline" onClick={onStockCount}>
                <ClipboardText aria-hidden="true" />
                Stock count
              </Button>
            ) : null}
            {onManageCategories ? (
              <Button variant="outline" onClick={onManageCategories}>
                <Tag aria-hidden="true" />
                Categories
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportProducts}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            {onAdd ? (
              <Button onClick={onAdd}>
                <Plus aria-hidden="true" />
                Add product
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Stock totals" min={180}>
        <StatCard compact label="Products" value={counts.all} caption={archived.length ? `${archived.length} no longer sold` : "in the catalogue"} />
        <StatCard
          compact
          label="Running low"
          value={counts.low + counts.out}
          caption={<Badge variant={counts.out ? "destructive" : "secondary"}>{counts.out} out of stock</Badge>}
          onClick={() => setGroup("low")}
        />
        <StatCard compact label="Stock value" value={formatPeso(stockValue)} caption="at selling price" />
        {materialsLoaded ? (
          <StatCard
            compact
            label="Raw materials to order"
            value={toOrder}
            caption={onOpenMaterials ? <TextLink className="text-xs" onClick={onOpenMaterials}>Open raw materials</TextLink> : null}
          />
        ) : null}
      </StatCards>

      <DataCard label="Products">
        <FilterBar>
          <SearchField label="Search products" value={query} onChange={setQuery} placeholder="Search name or code" />
          <FilterSelect label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <div role="group" aria-label="Stock level" className="inline-flex flex-wrap gap-1">
            {levels.map((level) => (
              <button
                key={level.value}
                type="button"
                aria-pressed={group === level.value}
                onClick={() => setGroup(level.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-13 font-medium text-foreground",
                  group === level.value ? "border-border bg-muted" : "border-border bg-card hover:bg-surface-2"
                )}
              >
                {level.label}
                <span className="text-xs text-muted-fg">{level.count}</span>
              </button>
            ))}
          </div>
          <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} className="ml-auto" />
        </FilterBar>

        {!isLoaded ? (
          <LoadingState noun="products" bare />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={rows.length === 0 && group === "all" ? "No products yet" : "No products match these filters"}
            description={
              rows.length === 0 && group === "all"
                ? "Add your first product and its stock level. Stock then goes up when a batch is finished and down when an order is completed."
                : "Try another name, or show every kind."
            }
            action={rows.length === 0 && group === "all" ? null : <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <Table minWidth={920} aria-label="Products">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-[120px]">Code</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="w-[170px]">On the shelf</TableHead>
                <TableHead className="w-[90px] text-right">Reorder at</TableHead>
                <TableHead className="w-[100px] text-right">Price</TableHead>
                <TableHead className="w-[120px]">Stock</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.visible.map(({ product, stock }) => {
                const landed = landedRow(change, "product", product.id);
                const level = showArchived ? { label: "No longer sold", tone: "neutral" } : LEVEL[stockGroup(stock)];
                const pct = stock.tracked ? Math.min(100, Math.round((Math.max(0, stock.available) / Math.max(1, stock.threshold * 2)) * 100)) : 0;
                return (
                  <TableRow key={landed.key} className={landed.className}>
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-fg-3">
                          {productIcon(product.productType, "size-3.5")}
                        </span>
                        <button type="button" data-slot="text-link" onClick={() => onView(product.id)} className="truncate border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline">
                          {product.name}
                        </button>
                      </span>
                    </TableCell>
                    <TableCell><Mono className="text-fg-3">{product.itemCode}</Mono></TableCell>
                    <TableCell className="text-fg-2">{KIND_LABEL[product.productType] ?? "Something else"}</TableCell>
                    <TableCell>
                      {stock.tracked ? (
                        <span className="flex items-center gap-2.5">
                          <span className="min-w-14">{stock.available}</span>
                          <span aria-hidden="true" className="relative h-1 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
                            <span className="absolute inset-y-0 left-0 bg-muted-2" style={{ width: `${pct}%` }} />
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-fg">Not tracked</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-fg">{stock.tracked ? stock.threshold : "—"}</TableCell>
                    <TableCell className="text-right">{formatPeso(product.unitPrice)}</TableCell>
                    <TableCell><StatusPill label={level.label} tone={level.tone} /></TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${product.name}`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-muted data-[popup-open]:bg-muted"
                        >
                          <DotsThree weight="bold" className="size-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onView(product.id)}>
                            <Eye aria-hidden="true" />
                            View product
                          </DropdownMenuItem>
                          {onEdit ? (
                            <DropdownMenuItem onClick={() => onEdit(product.id)}>
                              <PencilSimple aria-hidden="true" />
                              Edit product
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <TablePagination
          summary={`Showing ${paged.visible.length} of ${filtered.length} products`}
          page={paged.page}
          pageCount={paged.pageCount}
          onPage={paged.onPage}
        />
      </DataCard>
    </Page>
  );
}
