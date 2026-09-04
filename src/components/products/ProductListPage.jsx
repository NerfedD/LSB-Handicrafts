import { useEffect, useMemo, useState } from "react";

import { Eye, PackagePlus, Pencil } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import IconChip, { Mono } from "../shared/Chip";
import { FilterBar, RecordCard, StickyCta } from "../shared/ListScreen";
import usePaged from "../../hooks/usePaged";
import { matches } from "../../utils/search";
import { FilterChips, FilterSelect, Pager, SearchField } from "../shared/filters";
import { EmptyState, ErrorState, LoadingState } from "../shared/PageStates";
import { StockCell } from "../shared/StockBar";
import { productIcon } from "../shared/productIcons";
import { formatDimensions, formatUnit } from "../../utils/productFormat";
import { formatPeso } from "../../utils/profileFormat";
import { shelfItems, stockCounts } from "../../utils/productStock";
import { PRODUCT_TYPE_OPTIONS } from "../../utils/constants";
import { stockLabel, stockTone } from "../../utils/copy";

/**
 * Products & stock — screen 2f, and the reference screen for the whole system.
 *
 * ONE SCREEN, NOT TWO. There used to be an "Inventory" workspace holding stock
 * and a "Product / Item Profiles" list holding catalogue entries, on two
 * different visual systems, with two different nav entries, answering one
 * question between them. They are joined here (see utils/productStock) because
 * "how many 4-inch balls have we got and what do we charge" is a single
 * thought.
 *
 * WHAT EACH PIECE IS FOR:
 *
 *  - Counted chips. Every count is computed from the UNFILTERED set, so
 *    "Running low 7" is visible before the filter is applied. Nobody should
 *    have to click a filter to find out whether it has anything in it.
 *  - The stock bar. Nine pixels of colour that can be read from across the
 *    room, next to a number that cannot. The products list is read standing
 *    up, at a distance, by whoever is deciding what to make next.
 *  - "View" and "Edit" with words. A bare pencil and a bare bin two pixels
 *    apart is a destructive action waiting for a mis-tap; 44px buttons that say
 *    what they do are not.
 *  - "Not tracked" rather than 0 for a product with no stock row. Zero is a
 *    claim that the shelf is empty, and the make list would act on it.
 */

const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "stock", label: "Fewest on the shelf first" },
  { value: "price", label: "Cheapest first" },
  { value: "price-desc", label: "Most expensive first" },
];

const KIND_OPTIONS = [
  { value: "all", label: "All" },
  ...PRODUCT_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
];

/** The chip a row belongs to. `untracked` deliberately sits outside the three. */
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
  inventory = [],
  // Not displayed here, but pending orders are what "set aside for orders"
  // means -- and available stock is on-hand minus that. See utils/productStock.
  orders = [],
  onView,
  onEdit,
  onAdd,
  onGoToDashboard,
  onContext,
  initialFilter,
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("name");
  // Seeded from the dashboard. An attention row's button names a verb and
  // lands here with the matching chip already on, so the sentence somebody
  // read and the list they arrive at agree. It stays an ordinary chip
  // afterwards -- clearable, and not a mode.
  const [group, setGroup] = useState(initialFilter ?? "all");

  const rows = useMemo(
    () => shelfItems(products, inventory, orders),
    [products, inventory, orders]
  );
  const counts = useMemo(
    () => stockCounts(products, inventory, orders),
    [products, inventory, orders]
  );

  // The header's second line belongs to the shell, which renders above this
  // screen's lazy boundary and cannot know the counts. The screen pushes them
  // up instead of the header being left blank or showing a breadcrumb.
  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(
      counts.low > 0
        ? `${counts.all} products · ${counts.low} running low`
        : `${counts.all} products · none running low`
    );
  }, [counts.all, counts.low, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const list = rows.filter(({ product, stock }) => {
      if (group !== "all" && stockGroup(stock) !== group) return false;
      if (kind !== "all" && (product.productType ?? "other") !== kind) return false;
      return matches(query, product.name, product.itemCode, product.size);
    });

    const byName = (a, b) => String(a.product.name).localeCompare(String(b.product.name));

    switch (sort) {
      case "name-desc":
        return [...list].sort((a, b) => byName(b, a));
      // An untracked row has no number to sort on, so it goes last rather than
      // being treated as zero and topping a "fewest first" list.
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
  }, [rows, group, kind, query, sort]);

  const paged = usePaged(filtered);

  const chips = [
    { value: "all", label: "All", count: counts.all },
    { value: "in", label: "Plenty in stock", count: counts.in, tone: "green" },
    { value: "low", label: "Running low", count: counts.low, tone: "amber" },
    { value: "out", label: "Run out", count: counts.out, tone: "red" },
    // Only offered when there is something in it: a permanently empty chip
    // teaches people to ignore the chip row.
    ...(counts.untracked > 0
      ? [{ value: "untracked", label: "Stock not tracked", count: counts.untracked }]
      : []),
  ];

  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="products" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or SKU"
          id="product-search"
        />
        <FilterSelect label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} />
      </FilterBar>

      <FilterChips
        chips={chips}
        value={group}
        onChange={setGroup}
        label="Show which products"
      />

      {!isLoaded ? (
        <LoadingState noun="products" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PackagePlus />}
          title="No products yet"
          description="Add your first product and its stock level, and it will show up here for everyone."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
          actionLabel="Add a product"
          onAction={onAdd}
        />
      ) : (
        <>
          {/* ≥834px: the table. */}
          <Card className="hidden tab:block">
            <Table minWidth={900}>
              <TableCaption>Products and how many are on the shelf</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead className="w-40">Size</TableHead>
                  <TableHead className="w-56">Stock on shelf</TableHead>
                  <TableHead className="w-32">Price</TableHead>
                  <TableHead className="w-52 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map(({ product, stock }) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3.5">
                        <IconChip
                          icon={productIcon(product.productType)}
                          tone="neutral"
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[16.5px] font-bold">{product.name}</p>
                          <Mono className="block truncate">
                            {product.itemCode}
                            {product.size ? ` · ${product.size}` : ""}
                          </Mono>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-[15.5px] text-ink-2">
                      {formatDimensions(product)}
                    </TableCell>

                    <TableCell>
                      {stock.tracked ? (
                        <StockCell
                          count={stock.available}
                          label={stockLabel(stock.status)}
                          tone={stockTone(stock.status)}
                          value={stock.available}
                          max={stock.ceiling}
                        />
                      ) : (
                        <span className="text-[15px] text-muted-2">Not tracked</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="text-[16.5px] font-bold tabular-nums">
                        {formatPeso(product.unitPrice)}
                      </p>
                      <p className="pt-0.5 text-[13.5px] text-muted">
                        {formatUnit(product)}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onView(product.id)}>
                          <Eye className="h-4.5 w-4.5" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(product.id)}>
                          <Pencil className="h-4.5 w-4.5" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <CardFooter>
              <Pager {...paged} noun="products" className="w-full" />
            </CardFooter>
          </Card>

          {/* <834px: cards. */}
          <div className="flex flex-col gap-3 tab:hidden">
            {paged.visible.map(({ product, stock }) => (
              <RecordCard key={product.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <IconChip icon={productIcon(product.productType)} tone="neutral" size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[16.5px] font-bold">{product.name}</p>
                    <Mono className="block truncate">
                      {product.itemCode}
                      {product.size ? ` · ${product.size}` : ""}
                    </Mono>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 pt-3.5">
                  <div className="min-w-0 flex-1">
                    {stock.tracked ? (
                      <StockCell
                        count={stock.available}
                        label={stockLabel(stock.status)}
                        tone={stockTone(stock.status)}
                        value={stock.available}
                        max={stock.ceiling}
                      />
                    ) : (
                      <span className="text-[15px] text-muted-2">Stock not tracked</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[16.5px] font-bold tabular-nums">
                      {formatPeso(product.unitPrice)}
                    </p>
                    <p className="text-[13.5px] text-muted">{formatUnit(product)}</p>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => onView(product.id)}>
                    <Eye className="h-5 w-5" />
                    View
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => onEdit(product.id)}>
                    <Pencil className="h-5 w-5" />
                    Edit
                  </Button>
                </div>
              </RecordCard>
            ))}

            <Card className="p-4">
              <Pager {...paged} noun="products" />
            </Card>
          </div>

          <StickyCta>
            <Button variant="cobalt" size="xl" block onClick={onAdd}>
              <PackagePlus className="h-5.5 w-5.5" />
              Add a product
            </Button>
          </StickyCta>
        </>
      )}
    </div>
  );
}
