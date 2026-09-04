import { useMemo } from "react";

import { ArrowLeft, Boxes, Pencil } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import FactTable from "../shared/FactTable";
import { PhotoSlot } from "../shared/forms";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import { BarLegend, SegmentedBar } from "../shared/StockBar";
import { activityIcon } from "../shared/activityIcons";
import { productIcon } from "../shared/productIcons";
import { movementsFor, whenLabel } from "../../utils/activityLog";
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
 * STOCK MOVEMENTS ARE REAL ENTRIES, not a fabricated history. They come from
 * activity_log filtered to this product's item code — see utils/activityLog.
 * A product nothing has happened to yet says so rather than showing invented
 * rows.
 */
export default function ProductDetailPage({
  product,
  inventory = [],
  orders = [],
  activity = [],
  onBack,
  onEdit,
}) {
  const stock = useMemo(
    () => (product ? stockForProduct(product, inventory, orders) : { tracked: false }),
    [product, inventory, orders]
  );

  const movements = useMemo(
    () => (product ? movementsFor(product.itemCode, activity) : []),
    [product, activity]
  );

  if (!product) return <NotFoundState noun="product" onBack={onBack} />;

  const tone = stock.tracked ? stockTone(stock.status) : "neutral";
  const roomToFill = Math.max(0, (stock.ceiling ?? 0) - (stock.onHand ?? 0));

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

          <Button variant="outline" size="lg" block onClick={() => onEdit(product.id)}>
            <Pencil className="h-5 w-5" />
            Edit this product
          </Button>
        </div>

        {/* ---- the stock story ---- */}
        <div className="flex min-w-0 flex-col gap-4">
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

            {movements.length === 0 ? (
              <EmptySlot className="py-10 text-[15px]">
                Nothing has moved yet. Changes show up here as soon as stock is recorded or
                an order goes out.
              </EmptySlot>
            ) : (
              <Table minWidth={620}>
                <TableCaption>Every change to this product&rsquo;s stock</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-52">When</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead className="w-32 text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((entry) => {
                    const up = (entry.amount ?? 0) > 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-[15px] text-muted">
                          {whenLabel(entry.at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <IconChip
                              icon={activityIcon(entry.icon)}
                              tone={entry.tone}
                              size="sm"
                            />
                            <span className="min-w-0 text-[15.5px]">
                              <strong className="font-extrabold">{entry.who}</strong> {entry.what}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-[17px] font-extrabold tabular-nums",
                            entry.amount === null
                              ? "text-muted"
                              : up
                                ? "text-green dark:text-dk-green"
                                : "text-red dark:text-dk-red"
                          )}
                        >
                          {entry.amount === null ? "—" : `${up ? "+" : "−"}${Math.abs(entry.amount)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
