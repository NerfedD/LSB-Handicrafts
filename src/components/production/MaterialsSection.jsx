import { useState } from "react";

import { ArrowRight, CaretRight, ClipboardText, Cube, PencilSimple, Plus, Stack, Truck, X } from "../icons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Callout, { DangerBlock } from "../shared/Callout";
import { Mono } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import { EmptyState, Page, PageHeader, SearchField, SectionCard, StatCard, StatCards, TextLink } from "../shared/page";
import StatusPill from "../shared/StatusPill";
import StockHistory from "../shared/StockHistory";
import { ToggleChips } from "./parts";
import useStockMovements from "../../hooks/useStockMovements";
import { materialKindLabel, movementLabel } from "../../utils/copy";
import { availableMaterial, freeMaterial, materialShortfall, needsReorder, pluralUnit, units } from "../../utils/production";
import { formatShortDate } from "../../utils/profileFormat";

/**
 * Production · Raw materials, drawn to the "7b · Production · Raw materials"
 * board:
 *
 *   PageHeader (Supplier orders, Add material) → a compact stat strip →
 *   FilterBar (search, In use / Needs ordering / Out of stock, the bar's key)
 *   → the materials table (Material, Code, Stock bar, Status, open) beside a
 *   details panel for the chosen material.
 *
 * The panel's "Full history" opens the material's own screen (app-only),
 * built from the same parts: the panel's figures, the stock history, where
 * the material was used, and removing it.
 */
function materialStatus(material, batches) {
  const free = freeMaterial(material, batches);
  const short = materialShortfall(material, batches);
  const reserved = material.stock - availableMaterial(material, batches);
  if (material.status === "Archived") return { free, short, reserved, tone: "neutral", label: "No longer in use" };
  if (material.stock <= 0) return { free, short, reserved, tone: "red", label: "Out of stock" };
  if (short > 0) return { free, short, reserved, tone: "red", label: `Short by ${units(short, material.unit)}` };
  if (needsReorder(material, batches)) return { free, short, reserved, tone: "amber", label: "Running low" };
  return { free, short, reserved, tone: "green", label: "Enough" };
}

/** Set aside, free, and where the order-more level sits, on one 120px bar. */
function StockBar({ material, status }) {
  const max = Math.max(material.stock, material.low_stock_threshold * 2, 1);
  const aside = Math.max(0, Math.min(material.stock, status.reserved));
  const free = Math.max(0, status.free);
  return (
    <span
      role="img"
      aria-label={`${aside} set aside, ${free} free, order more below ${material.low_stock_threshold}`}
      className="relative inline-flex h-1.5 w-[120px] shrink-0 overflow-hidden rounded-sm bg-muted"
    >
      <span className="h-full bg-fg-3" style={{ width: `${(aside / max) * 100}%` }} />
      <span className="h-full bg-muted-2" style={{ width: `${(free / max) * 100}%` }} />
      <span className="absolute inset-y-0 w-px bg-danger" style={{ left: `${(material.low_stock_threshold / max) * 100}%` }} />
    </span>
  );
}

function Figures({ material, status }) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
      {[
        ["On hand", units(material.stock, material.unit)],
        ["Set aside", units(Math.max(0, status.reserved), material.unit)],
        ["Free to use", units(status.free, material.unit)],
      ].map(([label, value]) => (
        <div key={label} className="bg-card px-3 py-2">
          <div className="text-xs text-muted-fg">{label}</div>
          <div className="text-sm font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function RecentMovements({ material, limit }) {
  const movements = useStockMovements({ rawMaterialId: material.id, balance: material.stock });
  const rows = movements.rows.slice(0, limit);
  if (!rows.length) return <p className="m-0 px-1 py-2 text-13 text-muted-fg">{movements.isLoaded ? "Nothing has moved yet." : "Loading…"}</p>;
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-2 border-t border-row-divider py-1.5 text-13 first:border-t-0">
          <span className="w-16 shrink-0 text-muted-fg">{formatShortDate(row.at)}</span>
          <span className="min-w-0 flex-1 truncate">{movementLabel(row.kind)}</span>
          <span className={row.change > 0 ? "text-success-fg" : "text-danger-fg"}>{row.change > 0 ? `+${row.change}` : `−${Math.abs(row.change)}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** One material's stock history, re-read whenever its count changes. */
function MaterialHistory({ material, ws }) {
  const [busy, setBusy] = useState(false);
  const movements = useStockMovements({ rawMaterialId: material.id, balance: material.stock });
  const undo = ws.canUndoDamage
    ? async (movement) => {
        setBusy(true);
        await ws.onStockCommand("undo_damage", { movementId: movement.id }, crypto.randomUUID());
        setBusy(false);
      }
    : null;
  return <StockHistory rows={movements.rows} isLoaded={movements.isLoaded} error={movements.error} onUndoDamage={undo} busy={busy} />;
}

function usualSupplier(materialOrders, supplierName, id) {
  const mine = materialOrders.filter((o) => o.raw_material_id === id);
  const last = mine[mine.length - 1];
  const received = mine.filter((o) => o.actual_delivery_date).sort((a, b) => String(b.actual_delivery_date).localeCompare(String(a.actual_delivery_date)))[0];
  return { supplier: last ? supplierName(last.supplier_id) : "None yet", lastReceived: received ? formatShortDate(received.actual_delivery_date) : "Never" };
}

/** The panel's and the detail screen's actions, each only for who may do it. */
function MaterialActions({ ws, material, compact }) {
  const archived = material.status === "Archived";
  return (
    <div className="flex flex-wrap gap-2">
      {ws.manager && !archived ? (
        <Button variant="outline" size={compact ? "sm" : "default"} onClick={() => ws.setDialog({ kind: "order", preset: { raw_material_id: material.id } })}>
          Order more
        </Button>
      ) : null}
      {ws.canCorrectStock && !archived ? (
        <Button variant="outline" size={compact ? "sm" : "default"} onClick={() => ws.setDialog({ kind: "stock", mode: "correct", material })}>
          Count stock
        </Button>
      ) : null}
      {ws.canRecordDamage && !archived && material.stock > 0 ? (
        <Button variant="outline" size={compact ? "sm" : "default"} onClick={() => ws.setDialog({ kind: "stock", mode: "damage", material })}>
          Write off damage
        </Button>
      ) : null}
    </div>
  );
}

function DetailPanel({ ws, material, onClose }) {
  const status = materialStatus(material, ws.batches);
  const { supplier, lastReceived } = usualSupplier(ws.materialOrders, ws.supplierName, material.id);
  const using = ws.batches.filter((b) => b.raw_material_id === material.id && ["Queued", "In Progress", "Quality Check"].includes(b.status));
  return (
    <aside aria-labelledby="rm-detail-title" className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs lg:w-[340px] lg:shrink-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="rm-detail-title" className="m-0 text-sm font-semibold">{material.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Mono>{material.sku}</Mono>
            <StatusPill label={status.label} tone={status.tone} />
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <Figures material={material} status={status} />
      <MaterialActions ws={ws} material={material} compact />
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-13">
        <dt className="text-muted-fg">Order more below</dt><dd className="m-0">{units(material.low_stock_threshold, material.unit)}</dd>
        <dt className="text-muted-fg">Usual supplier</dt><dd className="m-0">{supplier}</dd>
        <dt className="text-muted-fg">Last received</dt><dd className="m-0">{lastReceived}</dd>
      </dl>
      <div>
        <h3 className="m-0 mb-1 text-13 font-semibold">Set aside for</h3>
        <ul className="m-0 list-none p-0">
          {using.length === 0 ? <li className="py-1 text-13 text-muted-fg">Nothing planned uses it right now.</li> : null}
          {using.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 border-t border-row-divider py-1.5 text-13 first:border-t-0">
              <span className="min-w-0 truncate"><Mono>{b.batch_code}</Mono> {ws.prod(b.target_product_id)?.name}</span>
              <span>{units(b.raw_material_used_qty, material.unit)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="m-0 mb-1 text-13 font-semibold">Recent movements</h3>
        <RecentMovements material={material} limit={4} />
        <TextLink className="mt-2" onClick={() => ws.onViewMaterial(material.id)}>
          Full history
          <ArrowRight className="size-4" aria-hidden="true" />
        </TextLink>
      </div>
    </aside>
  );
}

export default function MaterialsSection({ ws }) {
  const { materials, batches, materialOrders, change, query, setQuery } = ws;
  const [filter, setFilter] = useState(ws.initialFilter ?? "all");
  const [selectedId, setSelectedId] = useState(null);

  const inUse = materials.filter((m) => m.status !== "Archived");
  const archived = materials.filter((m) => m.status === "Archived");
  const toReorder = inUse.filter((m) => needsReorder(m, batches));
  const outOfStock = inUse.filter((m) => m.stock <= 0);
  const settingAside = batches.filter((b) => ["Queued", "In Progress", "Quality Check"].includes(b.status));
  const onTheWay = materialOrders.filter((o) => !["Arrived", "Cancelled"].includes(o.status));
  const needle = query.trim().toLowerCase();
  const rows = (filter === "archived" ? archived : inUse)
    .filter((m) => filter !== "reorder" || needsReorder(m, batches) || ws.justChanged("material", m.id))
    .filter((m) => filter !== "out" || m.stock <= 0 || ws.justChanged("material", m.id))
    .filter((m) => `${m.name} ${m.sku}`.toLowerCase().includes(needle));
  const selected = materials.find((m) => m.id === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        icon={Stack}
        title="Raw materials"
        description="What the workshop builds with. Pick a material to see its numbers and history."
        actions={
          <>
            <Button variant="outline" onClick={() => ws.onNavigate("raw-material-orders")}>
              <ClipboardText aria-hidden="true" />
              Supplier orders
            </Button>
            {ws.manager ? (
              <Button onClick={() => ws.setDialog({ kind: "material" })} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Add material
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Raw material totals" min={160}>
        <StatCard compact label="In use" value={inUse.length} caption={inUse.length === 1 ? "material" : "materials"} />
        <StatCard compact label="Needs ordering" value={toReorder.length} caption={`${outOfStock.length} out of stock`} onClick={() => setFilter("reorder")} />
        <StatCard compact label="Set aside for batches" value={settingAside.length} caption={settingAside.length === 1 ? "batch" : "batches"} />
        <StatCard compact label="On the way" value={onTheWay.length} caption={onTheWay.length === 1 ? "supplier order" : "supplier orders"} onClick={() => ws.onNavigate("raw-material-orders")} />
      </StatCards>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search materials" value={query} onChange={setQuery} placeholder="Search name or code" />
        <ToggleChips
          label="Show"
          value={filter}
          onChange={setFilter}
          chips={[
            { value: "all", label: "In use", count: inUse.length },
            { value: "reorder", label: "Needs ordering", count: toReorder.length },
            { value: "out", label: "Out of stock", count: outOfStock.length },
          ]}
        />
        <span className="flex-[1_1_0]" />
        <span aria-hidden="true" className="flex flex-wrap items-center gap-3 text-xs text-muted-fg">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-fg-3" />Set aside</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted-2" />Free</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-px bg-danger" />Order-more level</span>
        </span>
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <section aria-label="Raw materials" className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card shadow-xs">
          {rows.length === 0 ? (
            <EmptyState
              icon={Stack}
              title={filter === "archived" ? "No materials have been taken out of use" : materials.length ? "No materials match these filters" : "No raw materials yet"}
              description={ws.manager ? "Add the sheets, blocks and supplies the workshop builds with. Stock is added when a supplier order is received." : "A manager adds the sheets, blocks and supplies the workshop builds with."}
              action={filter !== "all" || query ? <Button variant="outline" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</Button> : null}
            />
          ) : (
            <Table minWidth={620} aria-label="Raw materials">
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-[110px]">Code</TableHead>
                  <TableHead className="w-[230px]">Stock</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
                  const status = materialStatus(m, batches);
                  const landed = landedRow(change, "material", m.id);
                  return (
                    <TableRow key={landed.key} data-state={m.id === selectedId ? "selected" : undefined} className={landed.className}>
                      <TableCell>
                        <button type="button" onClick={() => setSelectedId(m.id)} className="truncate border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline">
                          {m.name}
                        </button>
                      </TableCell>
                      <TableCell><Mono>{m.sku}</Mono></TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2.5">
                          <StockBar material={m} status={status} />
                          <span className="whitespace-nowrap text-fg-2"><span className="font-medium text-foreground">{status.free}</span> free</span>
                        </span>
                      </TableCell>
                      <TableCell><StatusPill label={status.label} tone={status.tone} /></TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open ${m.name}`} onClick={() => setSelectedId(m.id)}>
                          <CaretRight aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {archived.length > 0 && filter !== "archived" ? (
            <div className="border-t border-border px-4 py-2.5 text-13 text-muted-fg">
              {archived.length} {archived.length === 1 ? "material is" : "materials are"} no longer in use.{" "}
              <TextLink className="text-13" onClick={() => setFilter("archived")}>Show them</TextLink>
            </div>
          ) : null}
        </section>
        {selected ? <DetailPanel ws={ws} material={selected} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </Page>
  );
}

/** One raw material's own screen: reached from the panel's "Full history". */
export function MaterialDetail({ ws, material }) {
  const status = materialStatus(material, ws.batches);
  const archived = material.status === "Archived";
  const canTransfer = ws.manager && !archived && ws.inventory.some((i) => i.sku.toLowerCase() === material.sku.toLowerCase() && ["sheet", "block"].includes(i.productType));
  const used = ws.usage.filter((u) => ws.lots.some((l) => l.id === u.lot_id && l.raw_material_id === material.id));
  const { supplier, lastReceived } = usualSupplier(ws.materialOrders, ws.supplierName, material.id);
  const details = [
    materialKindLabel(material.material_type),
    material.thickness_in ? `${material.thickness_in} in thick` : null,
    material.length_ft && material.width_ft ? `${material.length_ft} × ${material.width_ft} ft` : null,
    material.density ? `${material.density} kg/m³` : null,
    material.weight_kg ? `${material.weight_kg} kg per ${material.unit}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to raw materials", onClick: () => ws.onNavigate("raw-materials") }}
        icon={Stack}
        title={material.name}
        description={<><Mono>{material.sku}</Mono> · {details}</>}
        actions={
          <>
            <Button variant="outline" onClick={() => ws.setDialog({ kind: "lots", material })}>
              <Cube aria-hidden="true" />
              See received lots
            </Button>
            {canTransfer ? (
              <Button variant="outline" onClick={() => ws.setDialog({ kind: "transfer", material })}>
                <Truck aria-hidden="true" />
                Move selling stock here
              </Button>
            ) : null}
            {ws.manager && !archived ? (
              <Button variant="outline" onClick={() => ws.setDialog({ kind: "material", record: material })}>
                <PencilSimple aria-hidden="true" />
                Edit details
              </Button>
            ) : null}
          </>
        }
      />

      <div className="relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs" role="group" aria-label={material.name}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold">On the shelf right now</h2>
          <StatusPill label={status.label} tone={status.tone} />
        </div>
        <Figures material={material} status={status} />
        {status.short > 0 ? (
          <p className="m-0 text-13 font-medium text-danger-fg">The batches already queued need {units(status.short, material.unit)} more than is on the shelf.</p>
        ) : null}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-13 sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
          <dt className="text-muted-fg">Order more below</dt><dd className="m-0">{units(material.low_stock_threshold, material.unit)}</dd>
          <dt className="text-muted-fg">Usual supplier</dt><dd className="m-0">{supplier}</dd>
          <dt className="text-muted-fg">Last received</dt><dd className="m-0">{lastReceived}</dd>
        </dl>
        <MaterialActions ws={ws} material={material} />
      </div>

      <SectionCard title="Stock history" description={`Every change to the count of ${pluralUnit(material.unit, 2)}, newest first`}>
        <div className="border-t border-border">
          <MaterialHistory material={material} ws={ws} />
        </div>
      </SectionCard>

      <SectionCard title="Where this material was used" description="Each completed batch records the received lots it used, oldest first.">
        {used.length === 0 ? (
          <p className="m-0 border-t border-border px-4 py-6 text-13 text-muted-fg">Nothing has been made from this material yet. Each finished batch records the lots it used.</p>
        ) : (
          <div className="border-t border-border">
            <Table minWidth={420}>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>From lot</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {used.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><Mono className="text-fg-2">{ws.batches.find((b) => b.id === u.batch_id)?.batch_code}</Mono></TableCell>
                    <TableCell className="text-fg-2">Lot #{u.lot_id}</TableCell>
                    <TableCell className="text-right">{units(u.quantity, material.unit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {archived ? (
        <Callout
          tone="amber"
          title="No longer in use"
          action={ws.canRemoveRecords ? (
            <Button variant="outline" size="sm" disabled={ws.working} onClick={() => ws.restoreMaterial(material)}>Put it back in use</Button>
          ) : null}
        >
          {material.name} is kept off the materials list and out of new supplier orders, batches and recipes. Everything it has been part of is unchanged.
        </Callout>
      ) : null}
      {ws.canRemoveRecords && !archived ? (
        <DangerBlock
          title="Remove this raw material"
          action={<Button variant="destructive-outline" onClick={() => ws.setRemoving(true)}>Remove {material.name}</Button>}
        >
          It disappears from the materials list, the order form and the recipe picker. If anything has ever happened to it, it is kept as &ldquo;no longer in use&rdquo; with its history and can be put back. A delivery on its way or a batch on the floor stops it either way.
        </DangerBlock>
      ) : null}
    </Page>
  );
}
