import { useMemo, useState } from "react";

import { ArchiveRestore, ArrowLeft, Boxes, ClipboardCheck, PackageX, Pencil } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Callout, { DangerBlock } from "../shared/Callout";
import IconChip, { Mono } from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import FactTable from "../shared/FactTable";
import { PhotoSlot } from "../shared/forms";
import { NotFoundState } from "../shared/PageStates";
import { BarLegend, SegmentedBar } from "../shared/StockBar";
import StockHistory from "../shared/StockHistory";
import { productIcon } from "../shared/productIcons";
import StockChangeDialog from "./StockChangeDialog";
import useStockMovements from "../../hooks/useStockMovements";
import { formatDimensions, formatProductType, formatUnit } from "../../utils/productFormat";
import { formatLongDate, formatPeso } from "../../utils/profileFormat";
import { stockForProduct } from "../../utils/productStock";
import { stockLabel, stockTone } from "../../utils/copy";
import { tone as toneOf } from "../shared/tones";
import { cn } from "@/lib/utils";

/**
 * One product — screen 2h.
 *
 * THE STOCK STORY IS THE SCREEN. A product's facts (its size, its price) change
 * once a year; how many are on the shelf changes daily, and is the only reason
 * anybody opens this page. So the facts are a quiet column on the left and the
 * right-hand card answers one question in a 52px number: how many can we sell
 * right now.
 *
 * THREE NUMBERS, NOT ONE. "On the shelf" is not the same as "free to sell" —
 * some of the shelf is already promised to orders that have not gone out yet.
 * Reporting only the shelf count is how the same ten balls get sold twice, and
 * reporting only the free count makes the shelf look emptier than it is. The
 * segmented bar puts them in proportion, and the legend names all three,
 * because a colour key without words is a key nobody can use.
 *
 * STOCK MOVEMENTS ARE THE LEDGER. Every change to the count -- sold, sent out,
 * returned, replaced, damaged, corrected, made -- is a row in stock_movements,
 * written by the database in the same transaction as the change. The two stock
 * actions here (record damage, correct the count) go through stock_command so
 * they land there too, with a reason; the product form no longer edits a count.
 *
 * REMOVING ONE LIVES AT THE BOTTOM, IN ITS OWN BLOCK, and only an admin sees it
 * — `canDelete`, the same shape as the supplier and customer screens. Rule 6:
 * never a red trash icon in a row.
 *
 * REFUSED WHILE STOCK IS PROMISED to an order still waiting. Otherwise the
 * database decides (remove_product): a product anything has happened to --
 * sold, made, counted -- is ARCHIVED, which hides it from the lists and the
 * order form and keeps every record; only a product nothing refers to is
 * deleted, catalogue entry and stock row together in one transaction.
 */
export default function ProductDetailPage({
  product,
  inventory = [],
  orders = [],
  canEdit = false,
  canRecordDamage = false,
  canCorrectStock = false,
  canUndoDamage = false,
  canDelete = false,
  onBack,
  onEdit,
  onDelete,
  onRestore,
  onStockCommand,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [stockDialog, setStockDialog] = useState(null); // 'damage' | 'correct' | null
  const stock = useMemo(
    () => (product ? stockForProduct(product, inventory, orders) : { tracked: false }),
    [product, inventory, orders]
  );
  const movements = useStockMovements({ inventoryId: stock.tracked ? stock.rowId : null, balance: stock.onHand });

  if (!product) return <NotFoundState noun="product" onBack={onBack} />;

  const archived = product.status === "Archived";

  const tone = stock.tracked ? stockTone(stock.status) : "neutral";
  const roomToFill = Math.max(0, (stock.ceiling ?? 0) - (stock.onHand ?? 0));
  const promised = stock.tracked ? stock.reserved ?? 0 : 0;
  const blocked = promised > 0;

  /**
   * Puts back stock written off by a damage record entered wrong. The database
   * works out how much from the record itself and allows it once, so there is
   * nothing to type and nothing to get wrong a second time.
   */
  async function undoDamage(movement) {
    setWorking(true);
    await onStockCommand?.("undo_damage", { movementId: movement.id }, crypto.randomUUID());
    setWorking(false);
  }

  async function runDelete() {
    setWorking(true);
    await onDelete?.(product);
    setWorking(false);
    setConfirming(false);
  }

  const segments = [
    { label: "Free to sell", value: Math.max(0, stock.available ?? 0), tone: "green" },
    { label: "Set aside for orders", value: stock.reserved ?? 0, tone: "amber" },
    { label: "Room to fill", value: roomToFill, tone: null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        All products
      </Button>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---- the facts ---- */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <PhotoSlot label="Product photo" hint="800 × 800" />
            <div className="flex items-center gap-2.5 pt-3.5">
              <IconChip icon={productIcon(product.productType)} tone="neutral" size="sm" />
              <Mono className="truncate text-[15px]">{product.itemCode}</Mono>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What it is</CardTitle>
            </CardHeader>
            <FactTable
              rows={[
                { label: "Kind", value: formatProductType(product.productType) },
                { label: "Category", value: stock.category ?? null },
                { label: "Size", value: formatDimensions(product) },
                { label: "Price", value: formatPeso(product.unitPrice) },
                { label: "Sold", value: formatUnit(product) },
                {
                  label: "Warn me below",
                  value:
                    (stock.tracked ? stock.threshold : product.lowStockThreshold) != null
                      ? `${stock.tracked ? stock.threshold : product.lowStockThreshold} left`
                      : null,
                },
                { label: "Added", value: formatLongDate(product.createdAt) },
              ]}
            />
          </Card>

          {canEdit && (
            <Button variant="outline" size="lg" block onClick={() => onEdit(product.id)}>
              <Pencil className="h-5 w-5" />
              Edit this product
            </Button>
          )}
        </div>

        {/* ---- the stock story ---- */}
        <div className="flex min-w-0 flex-col gap-4">
          {archived && (
            <Callout
              tone="amber"
              icon={<ArchiveRestore />}
              title="No longer sold"
              action={
                canEdit && (
                  <Button variant="outline" size="sm" onClick={() => onRestore?.(product)}>
                    <ArchiveRestore className="h-4.5 w-4.5" />
                    Put it back on sale
                  </Button>
                )
              }
            >
              It is hidden from the products list and the order form. Its stock record and
              every order, delivery and batch that mentions it are kept.
            </Callout>
          )}

          <Card className="p-5.5">
            {stock.tracked ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-muted">
                      On the shelf right now
                    </p>
                    <p
                      className={cn(
                        "pt-1 text-[52px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
                        toneOf(tone).text
                      )}
                    >
                      {stock.onHand}
                    </p>
                    <p className="pt-2 text-[15.5px] text-muted">
                      {stockLabel(stock.status)} — we warn you below {stock.threshold}.
                    </p>
                  </div>

                  <div className="flex items-stretch gap-6">
                    <div className="text-right">
                      <p className="text-[14.5px] text-muted">
                        Set aside for orders
                      </p>
                      <p className="pt-1 text-[26px] font-extrabold tabular-nums text-ink">
                        {stock.reserved}
                      </p>
                    </div>
                    <div
                      className="w-px shrink-0 bg-rule"
                      aria-hidden="true"
                    />
                    <div className="text-right">
                      <p className="text-[14.5px] text-muted">Free to sell</p>
                      <p className="pt-1 text-[26px] font-extrabold tabular-nums text-green dark:text-dk-green">
                        {Math.max(0, stock.available)}
                      </p>
                    </div>
                  </div>
                </div>

                <SegmentedBar segments={segments} className="mt-5" />
                <BarLegend segments={segments} className="pt-3.5" />

                {(canRecordDamage || canCorrectStock) && (
                  <div className="mt-5 flex flex-wrap gap-2.5 border-t border-hair pt-4.5">
                    {canRecordDamage && (
                      <Button variant="outline" disabled={stock.onHand <= 0} onClick={() => setStockDialog("damage")}>
                        <PackageX className="h-4.5 w-4.5" />
                        Record damage
                      </Button>
                    )}
                    {canCorrectStock && (
                      <Button variant="outline" onClick={() => setStockDialog("correct")}>
                        <ClipboardCheck className="h-4.5 w-4.5" />
                        Correct the count
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[18px] font-extrabold text-ink">
                  Nobody is counting this one yet
                </p>
                <p className="pt-2 max-w-[46ch] text-[15.5px] leading-[1.55] text-muted">
                  There is no stock record against{" "}
                  <Mono className="text-[15px]">{product.itemCode}</Mono>, so we cannot say how
                  many there are. That is different from having none — until somebody counts
                  them, the honest answer is that we do not know.
                </p>
              </>
            )}
          </Card>

          <Card>
            <CardHeader>
              <IconChip icon={<Boxes />} tone="clay" size="sm" />
              <CardTitle>Stock movements</CardTitle>
            </CardHeader>

            <StockHistory
              rows={movements.rows}
              isLoaded={movements.isLoaded}
              error={movements.error}
              busy={working}
              onUndoDamage={canUndoDamage ? undoDamage : null}
            />
          </Card>
        </div>
      </div>

      {/* ---- the only place a product can be removed ---- */}
      {canDelete && !archived && (
        <DangerBlock
          title="Remove this product"
          action={
            blocked ? null : (
              <Button variant="danger" size="lg" onClick={() => setConfirming(true)}>
                Remove {product.name}
              </Button>
            )
          }
        >
          {blocked ? (
            <>
              {promised} of these {promised === 1 ? "is" : "are"} promised to an order that
              has not gone out yet, so {product.name} cannot be removed — the order would be
              left asking for something the system no longer counts. Finish or cancel that
              order first and this becomes available.
            </>
          ) : (
            <>
              {product.name} disappears from the products list and the order form. If it
              has ever been sold, made or counted, it is kept as &ldquo;no longer sold&rdquo;
              with all of its history, and can be put back on sale. Only a product nothing
              has ever happened to is deleted outright. Past orders are never changed.
            </>
          )}
        </DangerBlock>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        title={`Remove ${product.name}?`}
        consequences={
          <>
            It stops appearing in the products list and on new orders. Anything that has
            happened to it is kept, and a product with history can be put back on sale.
            Past orders keep their lines exactly as written.
          </>
        }
        confirmLabel="Yes, remove it"
        busy={working}
        onConfirm={runDelete}
      />

      {stockDialog && stock.tracked && (
        <StockChangeDialog
          mode={stockDialog}
          target="product"
          record={{ id: stock.rowId, name: product.name, stock: stock.onHand, unit: product.unit }}
          onSave={(values, requestId) =>
            onStockCommand(stockDialog === "damage" ? "record_damage" : "correct_count", values, requestId)}
          onClose={() => setStockDialog(null)}
        />
      )}
    </div>
  );
}
