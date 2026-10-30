import { useMemo, useState } from "react";

import { ArrowUUpLeft, Camera, Plus } from "../icons";
import { Button } from "@/components/ui/button";
import Callout, { DangerBlock } from "../shared/Callout";
import { Mono } from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import { NotFoundState } from "../shared/PageStates";
import { Page, PageHeader, TextLink } from "../shared/page";
import StatusPill from "../shared/StatusPill";
import StockHistory from "../shared/StockHistory";
import StockChangeDialog from "./StockChangeDialog";
import useStockMovements from "../../hooks/useStockMovements";
import useProductImage from "../../hooks/useProductImage";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "../../utils/constants";
import { BATCH_LABEL, stockTone } from "../../utils/copy";
import { normalizeItems } from "../../utils/orderItems";
import { deliveryForOrder } from "../../utils/orders";
import { dueLabel } from "../../utils/deliveries";
import { units } from "../../utils/production";
import { formatDimensions, formatProductType, formatUnit } from "../../utils/productFormat";
import { formatLongDate, formatPeso, formatShortDate } from "../../utils/profileFormat";
import { stockForProduct } from "../../utils/productStock";

/**
 * One product, drawn to the "19 · Product detail" board:
 *
 *   Back to Inventory → the header (photo, name, stock badge, code · kind ·
 *   price; Count stock, Edit details, Plan a batch) → five stock numbers →
 *   the shelf count over the last 30 days → open orders that need it →
 *   stock history, beside Details, what it is made from, and its batches.
 *
 * Removing a product, putting one back on sale and the full stock history
 * stay, built from the same parts.
 */
function Panel({ id, title, description, action, children }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <h2 id={id} className="m-0 text-sm font-semibold">{title}</h2>
          {description ? <p className="m-0 text-13 text-muted-fg">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The shelf count over the last 30 days, read back from the stock movements. */
function ShelfTrend({ movements, onHand, threshold, now }) {
  const W = 600;
  const H = 120;
  const start = now - 30 * 86_400_000;
  const points = useMemo(() => {
    const chronological = [...movements].filter((m) => m.at).sort((a, b) => new Date(a.at) - new Date(b.at));
    const before = chronological.filter((m) => new Date(m.at).getTime() < start).pop();
    const inside = chronological.filter((m) => new Date(m.at).getTime() >= start);
    const first = before ? before.balanceAfter : inside.length ? inside[0].balanceAfter - inside[0].change : onHand;
    return [{ t: start, v: first }, ...inside.map((m) => ({ t: new Date(m.at).getTime(), v: m.balanceAfter })), { t: now, v: onHand }];
  }, [movements, onHand, start, now]);
  const max = Math.max(threshold || 0, ...points.map((p) => p.v), 1) * 1.15;
  const x = (t) => ((t - start) / (now - start)) * W;
  const y = (v) => H - (v / max) * H;
  let d = "";
  points.forEach((p, i) => {
    d += i === 0 ? `M${x(p.t)} ${y(p.v)}` : `H${x(p.t)} V${y(p.v)}`;
  });
  return (
    <div className="px-4 pb-4">
      <svg role="img" aria-label={`On the shelf over the last 30 days, now ${onHand}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[120px] w-full overflow-visible">
        {threshold ? <path d={`M0 ${y(threshold)}H${W}`} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
        <path d={`M0 ${H - 0.5}H${W}`} stroke="var(--border-subtle)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="var(--primary-text)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-2xs text-muted-fg">
        <span>{formatShortDate(new Date(start).toISOString())}</span>
        <span>Today · {onHand}</span>
      </div>
    </div>
  );
}

export default function ProductDetailPage({
  product,
  inventory = [],
  orders = [],
  deliveries = [],
  batches = [],
  recipes = [],
  materials = [],
  staff = [],
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
  onPlanBatch,
  onOpenOrder,
  onOpenMaterial,
  onOpenBatches,
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [stockDialog, setStockDialog] = useState(null);
  const [fullHistory, setFullHistory] = useState(false);
  const [now] = useState(() => Date.now());
  const stock = useMemo(() => (product ? stockForProduct(product, inventory, orders) : { tracked: false }), [product, inventory, orders]);
  const movements = useStockMovements({ inventoryId: stock.tracked ? stock.rowId : null, balance: stock.onHand });
  const image = useProductImage(product?.id ?? null, product?.updatedAt);

  if (!product) return <NotFoundState noun="product" onBack={onBack} />;

  const archived = product.status === "Archived";
  const promised = stock.tracked ? stock.reserved ?? 0 : 0;
  const mine = (b) => b.target_product_id === product.id;
  const productBatches = batches.filter(mine).slice().reverse();
  const beingMade = productBatches.filter((b) => ["Queued", "In Progress", "Quality Check"].includes(b.status)).reduce((s, b) => s + b.target_output_qty, 0);
  const recipe = recipes.filter((r) => r.product_id === product.id);
  const matchesProduct = (item) =>
    String(item.code || item.itemCode || item.sku || "").toLowerCase() === String(product.itemCode).toLowerCase() || item.name === product.name;
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soldThisMonth = orders
    .filter((o) => o.status !== ORDER_STATUS.CANCELLED && o.createdAt && new Date(o.createdAt).getTime() >= monthStart.getTime())
    .reduce((s, o) => s + normalizeItems(o.items).filter(matchesProduct).reduce((n, line) => n + (Number(line.quantity) || 0), 0), 0);
  const needing = orders
    .filter((o) => o.status === ORDER_STATUS.PENDING)
    .map((o) => ({ order: o, qty: normalizeItems(o.items).filter(matchesProduct).reduce((n, line) => n + (Number(line.quantity) || 0), 0) }))
    .filter((row) => row.qty > 0);
  const ordered = needing.reduce((s, r) => s + r.qty, 0);
  const tone = stock.tracked ? stockTone(stock.status) : "neutral";
  const badgeLabel = !stock.tracked ? "Not tracked" : stock.isOut ? "Out of stock" : stock.isLow ? "Running low" : "In stock";
  const month = monthStart.toLocaleDateString("en-US", { month: "long" });
  const worker = (id) => staff.find((s) => s.id === id)?.name;

  async function undoDamage(movement) {
    setWorking(true);
    await onStockCommand?.("undo_damage", { movementId: movement.id }, crypto.randomUUID());
    setWorking(false);
  }

  const figures = [
    ["On the shelf", stock.tracked ? stock.onHand : "—"],
    ["Set aside for orders", stock.tracked ? stock.reserved : "—"],
    ["Free to sell", stock.tracked ? Math.max(0, stock.available) : "—"],
    ["Being made", beingMade],
    [`Sold in ${month}`, soldThisMonth],
  ];

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to Inventory", onClick: onBack }}
        title={product.name}
        titleBadge={<StatusPill label={archived ? "No longer sold" : badgeLabel} tone={archived ? "neutral" : tone} />}
        description={<><Mono>{product.itemCode}</Mono> · {formatProductType(product.productType)} · {formatPeso(product.unitPrice)} {formatUnit(product).replace(/^per /, "per ")}</>}
        actions={
          <>
            {stock.tracked && !archived && (canCorrectStock || canRecordDamage) ? (
              <Button variant="outline" onClick={() => setStockDialog(canCorrectStock ? "correct" : "damage")}>Count stock</Button>
            ) : null}
            {canEdit ? <Button variant="outline" onClick={() => onEdit(product.id)}>Edit details</Button> : null}
            {onPlanBatch && !archived ? (
              <Button onClick={() => onPlanBatch(product.id)} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Plan a batch
              </Button>
            ) : null}
          </>
        }
        leading={
          <button
            type="button"
            aria-label={image.photo?.dataUrl ? `Photo of ${product.name}` : "Add a photo of this product"}
            disabled={!canEdit}
            onClick={() => onEdit(product.id)}
            className="flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border border-dashed border-border bg-surface-2 text-2xs text-muted-fg enabled:hover:bg-muted"
          >
            {image.photo?.dataUrl ? (
              <img src={image.photo.dataUrl} alt="" className="size-full object-cover" />
            ) : (
              <>
                <Camera className="size-[18px]" aria-hidden="true" />
                Photo
              </>
            )}
          </button>
        }
      />

      {archived ? (
        <Callout
          tone="amber"
          icon={<ArrowUUpLeft />}
          title="No longer sold"
          action={canEdit ? <Button variant="outline" size="sm" onClick={() => onRestore?.(product)}>Put it back on sale</Button> : null}
        >
          It is hidden from the products list and the order form. Its stock record and every order, delivery and batch that mentions it are kept.
        </Callout>
      ) : null}

      <section aria-label="Stock numbers" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-xs sm:grid-cols-5">
        {figures.map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-3">
            <div className="text-13 font-medium text-muted-fg">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          {stock.tracked ? (
            <Panel
              id="pd-trend"
              title="On the shelf, last 30 days"
              description={stock.isLow || stock.isOut ? `Below its warning level of ${stock.threshold}` : `Warns below ${stock.threshold}`}
              action={
                <span aria-hidden="true" className="flex gap-3 text-xs text-muted-fg">
                  <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-primary-text" />On the shelf</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-0 w-3 border-t border-dashed border-warning" />Warn below</span>
                </span>
              }
            >
              <ShelfTrend movements={movements.rows} onHand={stock.onHand} threshold={stock.threshold} now={now} />
            </Panel>
          ) : (
            <Callout tone="neutral" title="Nobody is counting this one yet">
              There is no stock record against <Mono>{product.itemCode}</Mono>, so we cannot say how many there are. That is different from having none.
            </Callout>
          )}

          <Panel id="pd-orders" title="Open orders that need it" description={`${ordered} ordered · ${promised} set aside · ${Math.max(0, ordered - promised)} still to make${beingMade ? `. Batches make ${beingMade}.` : "."}`}>
            {needing.length === 0 ? (
              <p className="m-0 border-t border-row-divider px-4 py-3 text-13 text-muted-fg">No open order is waiting for it.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {needing.map(({ order, qty }) => {
                  const delivery = deliveryForOrder(order, deliveries);
                  return (
                    <li key={order.id} className="flex items-center gap-3 border-t border-row-divider px-4 py-2 text-13">
                      <TextLink className="text-13" onClick={() => onOpenOrder?.(order.id)}>#{order.id}</TextLink>
                      <span className="min-w-0 flex-1 truncate">{order.customerName}</span>
                      <span className="font-medium">{qty}</span>
                      <span className="w-32 text-right text-muted-fg">{delivery ? dueLabel(delivery) : "No delivery"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            id="pd-moves"
            title="Stock history"
            action={stock.tracked && movements.rows.length > 4 ? <TextLink onClick={() => setFullHistory((v) => !v)}>{fullHistory ? "Show less" : "Full history"}</TextLink> : null}
          >
            <div className="border-t border-border">
              <StockHistory
                rows={fullHistory ? movements.rows : movements.rows.slice(0, 4)}
                isLoaded={movements.isLoaded}
                error={movements.error}
                busy={working}
                onUndoDamage={canUndoDamage ? undoDamage : null}
              />
            </div>
          </Panel>
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <Panel id="pd-details" title="Details">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-row-divider px-4 py-3 text-13">
              <dt className="text-muted-fg">Kind</dt><dd className="m-0">{formatProductType(product.productType)}</dd>
              {stock.category ? (<><dt className="text-muted-fg">Category</dt><dd className="m-0">{stock.category}</dd></>) : null}
              <dt className="text-muted-fg">Size</dt><dd className="m-0">{formatDimensions(product)}</dd>
              <dt className="text-muted-fg">Price</dt><dd className="m-0">{formatPeso(product.unitPrice)} {formatUnit(product)}</dd>
              <dt className="text-muted-fg">Warn below</dt><dd className="m-0">{stock.tracked ? stock.threshold : product.lowStockThreshold ?? "—"} on the shelf</dd>
              <dt className="text-muted-fg">Added</dt><dd className="m-0">{formatLongDate(product.createdAt)}</dd>
            </dl>
          </Panel>

          <Panel id="pd-recipe" title="Made from" action={onOpenBatches ? <Button variant="ghost" size="sm" onClick={onOpenBatches}>Edit recipe</Button> : null}>
            {recipe.length === 0 ? (
              <p className="m-0 border-t border-row-divider px-4 py-3 text-13 text-muted-fg">No recipe saved. A batch takes a custom material count.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {recipe.map((r) => {
                  const material = materials.find((m) => m.id === r.raw_material_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 border-t border-row-divider px-4 py-2 text-13">
                      <TextLink className="text-13" onClick={() => onOpenMaterial?.(r.raw_material_id)}>{material?.name ?? "Material"}</TextLink>
                      <span className="text-muted-fg">{units(r.material_qty, material?.unit)} per {r.output_qty}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel id="pd-batches" title="Batches">
            {productBatches.length === 0 ? (
              <p className="m-0 border-t border-row-divider px-4 py-3 text-13 text-muted-fg">None yet.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {productBatches.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center gap-2 border-t border-row-divider px-4 py-2 text-13">
                    <Mono className="text-fg-2">{b.batch_code}</Mono>
                    <span className="min-w-0 flex-1 truncate text-muted-fg">
                      {b.target_output_qty} · {b.status === "Completed" ? formatShortDate(b.completed_at) : worker(b.assigned_staff_id) ?? ""}
                    </span>
                    <span className={cn("text-xs", b.status === "Completed" ? "text-success-fg" : "text-fg-2")}>{BATCH_LABEL[b.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      {canDelete && !archived ? (
        <DangerBlock
          title="Remove this product"
          action={promised > 0 ? null : <Button variant="destructive-outline" onClick={() => setConfirming(true)}>Remove {product.name}</Button>}
        >
          {promised > 0
            ? `${promised} of these ${promised === 1 ? "is" : "are"} promised to an order that has not gone out yet, so ${product.name} cannot be removed. Finish or cancel that order first.`
            : `${product.name} disappears from the products list and the order form. If it has ever been sold, made or counted, it is kept as “no longer sold” with its history and can be put back on sale.`}
        </DangerBlock>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        title={`Remove ${product.name}?`}
        consequences="It stops appearing in the products list and on new orders. Anything that has happened to it is kept, and a product with history can be put back on sale. Past orders keep their lines exactly as written."
        confirmLabel="Yes, remove it"
        busy={working}
        onConfirm={async () => {
          setWorking(true);
          await onDelete?.(product);
          setWorking(false);
          setConfirming(false);
        }}
      />

      {stockDialog && stock.tracked ? (
        <StockChangeDialog
          mode={stockDialog}
          target="product"
          record={{ id: stock.rowId, name: product.name, stock: stock.onHand, unit: product.unit }}
          canCorrect={canCorrectStock}
          canDamage={canRecordDamage}
          onSave={(values, requestId, mode = stockDialog) => onStockCommand(mode === "damage" ? "record_damage" : "correct_count", values, requestId)}
          onClose={() => setStockDialog(null)}
        />
      ) : null}
    </Page>
  );
}
