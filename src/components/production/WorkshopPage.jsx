import { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, Boxes, ClipboardCheck, ClipboardList, Hammer, Layers, Package, PackageX, Plus, Truck } from '../icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import Callout from '../shared/Callout';
import IconChip, { Mono } from '../shared/Chip';
import StatusPill from '../shared/StatusPill';
import StockBar from '../shared/StockBar';
import Landed from '../shared/Landed';
import { StatTiles } from '../shared/FactTable';
import { FilterBar } from '../shared/ListScreen';
import { FilterChips, SearchField } from '../shared/filters';
import { EmptyState, ErrorState, LoadingState, NotFoundState } from '../shared/PageStates';
import { productIcon } from '../shared/productIcons';
import StockHistory from '../shared/StockHistory';
import useStockMovements from '../../hooks/useStockMovements';
import { can } from '../../utils/permissions';
import {
  BATCH_LABEL, BATCH_TONE, MATERIAL_ORDER_LABEL, MATERIAL_ORDER_TONE, materialKindLabel,
} from '../../utils/copy';
import {
  availableMaterial, freeMaterial, materialShortfall, needsReorder, pluralUnit, productionTotals, units,
} from '../../utils/production';
import { formatPeso, formatShortDate } from '../../utils/profileFormat';
import { makeList } from '../../utils/dashboard';
import WorkshopForm, { ReviewBox } from './WorkshopForm';
import { MaterialDialog, RecipeDialog, SupplierOrderDialog, TransferDialog, WorkshopConfirmation } from './WorkshopEditors';
import ReceiveSupplierDeliveryDialog from '../suppliers/ReceiveSupplierDeliveryDialog';
import CompleteBatchDialog from '../products/CompleteBatchDialog';
import StartBatchDialog from '../products/StartBatchDialog';
import StockChangeDialog from '../products/StockChangeDialog';

/**
 * The workshop's four screens: raw materials, what arrived from suppliers,
 * what to make next, and what got damaged.
 *
 * WHY EVERY REPEATED ACTION HERE IS AN OUTLINE BUTTON. Clay is the workshop's
 * accent, and the make list once spent it on the section tab, the filter chip,
 * the header action, four make-list rows and a batch card at the same time —
 * nine orange slabs, after which none of them meant "this is the thing to do".
 * The rule this now follows is the system's: one solid accent button per
 * screen, in the header row, and every row-level action is an outline button
 * with an icon and a word. See DESIGN.md → Buttons.
 */

/* -------------------------------------------------------------------------- */

const SECTIONS = [
  { key: 'raw-materials', label: 'Raw materials' },
  { key: 'raw-material-orders', label: 'Supplier deliveries' },
  { key: 'production', label: 'Make list' },
  { key: 'production-report', label: 'Damage & yield', managerOnly: true },
];

/**
 * The sub-navigation across the top.
 *
 * Deliberately NOT the solid clay slab it used to be: a tab strip is a
 * position indicator, not an action, so it borrows the selected-chip
 * inversion the filter rows already use (ink fill, surface text) which reads
 * as "you are here" in both themes without a `dark:` variant. On a phone it
 * scrolls sideways in one row rather than wrapping into a ragged three-line
 * block with a stranded tab floating to the right.
 */
function SectionTabs({ section, sections, onNavigate }) {
  const current = useRef(null);

  // Scrolling the strip is only useful if the tab you are on is in it. On a
  // phone "Damage & yield" sits off the right edge, so landing there showed
  // four tabs, none of them marked, until somebody thought to swipe.
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [section]);

  return (
    <nav aria-label="Workshop sections" className="-mx-4 overflow-x-auto px-4 tab:mx-0 tab:px-0">
      <ul className="flex w-max gap-2.5 tab:w-auto tab:flex-wrap">
        {sections.map(({ key, label }) => {
          const here = section === key;
          return (
            <li key={key}>
              <button
                ref={here ? current : undefined}
                type="button"
                aria-current={here ? 'page' : undefined}
                onClick={() => onNavigate(key)}
                className={cn(
                  'inline-flex h-11 items-center whitespace-nowrap rounded-full border-[1.5px] px-4.5 text-[15.5px] font-bold transition duration-150',
                  here
                    ? 'border-ink bg-ink text-surface'
                    : 'border-chip bg-surface text-ink hover:bg-wash'
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A card's own row of actions: always outline, always icon plus word. */
function RowActions({ children }) {
  return <div className="flex flex-wrap gap-2.5 border-t border-hair px-5.5 py-4">{children}</div>;
}

function SectionCard({ title, action, children, className }) {
  return (
    <Card className={className}>
      <CardHeader className="justify-between">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

/** A list inside a card: 62px rows, hairlines between but not after the last. */
function RowList({ children, className }) {
  return <ul className={cn('divide-y divide-hair', className)}>{children}</ul>;
}

function Row({ children, className }) {
  return (
    <li className={cn('flex min-h-15.5 flex-wrap items-center justify-between gap-3.5 px-5.5 py-3.5', className)}>
      {children}
    </li>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * How much of this material is really there, in the three numbers a manager
 * asks about in order: what is on the shelf, what the unfinished batches have
 * already claimed, and what is left for a new job.
 *
 * `availableMaterial` can go negative — queued batches are allowed to reserve
 * more than is on hand, and that shortfall is exactly what somebody needs to
 * be told. It used to be printed straight out as "48 sheet on hand · -7
 * available", which reads as a rendering fault rather than as "you are seven
 * sheets short". It is stated in words now, in its own amber pill.
 */
function materialStatus(material, batches) {
  const free = freeMaterial(material, batches);
  const short = materialShortfall(material, batches);
  const reserved = material.stock - availableMaterial(material, batches);

  if (short > 0) {
    return { free, short, reserved, tone: 'red', mark: 'x', label: `Short by ${units(short, material.unit)}` };
  }
  if (needsReorder(material, batches)) {
    return { free, short, reserved, tone: 'amber', mark: 'clock', label: 'Running low' };
  }
  return { free, short, reserved, tone: 'green', mark: 'check', label: 'Enough material' };
}

function MaterialFigures({ material, batches }) {
  const { free, short, reserved, tone } = materialStatus(material, batches);
  return (
    <div className="px-5.5 py-4.5">
      <p className="flex items-baseline gap-2">
        <span className="text-[26px] font-extrabold tabular-nums text-ink">{material.stock}</span>
        <span className="text-muted">{pluralUnit(material.unit, material.stock)} on hand</span>
      </p>
      {/* Measured against the level this material is meant to be kept at, not
          against its own current count — free/stock is 100% for anything with
          no batch queued against it, so a material that is nearly out drew a
          full bar next to its own "Running low" pill. */}
      <StockBar value={free} max={Math.max(material.stock, material.low_stock_threshold)} tone={tone} className="mt-2.5 max-w-none" />
      <p className="pt-2.5 text-[15px] text-muted">
        <strong className="font-bold tabular-nums text-ink">{free}</strong> free to use
        {' · '}
        <strong className="font-bold tabular-nums text-ink">{reserved}</strong> set aside for unfinished batches
      </p>
      {short > 0 && (
        <p className="pt-1.5 text-[15px] font-bold text-red-text">
          The batches already queued need {units(short, material.unit)} more than is on the shelf.
        </p>
      )}
    </div>
  );
}

/** One material's stock history, re-read whenever its count changes. */
function MaterialHistory({ material }) {
  const movements = useStockMovements({ rawMaterialId: material.id, balance: material.stock });
  return <StockHistory rows={movements.rows} isLoaded={movements.isLoaded} error={movements.error} />;
}

/* -------------------------------------------------------------------------- */

export default function WorkshopPage({ section, materialId, onViewMaterial, profile, data, isLoaded, error, onRetry, onCommand, onStockCommand, onContext, onNavigate, change, initialFilter }) {
  const { materials, materialOrders, batches, recipes, defects, lots, usage, products, inventory, orders, suppliers, staff } = data;
  const [dialog, setDialog] = useState(null);
  const [filter, setFilter] = useState(initialFilter ?? (section === 'raw-materials' ? 'all' : 'active'));
  const [query, setQuery] = useState('');

  const manager = can(profile.role, 'manageSuppliers');
  const canMake = can(profile.role, 'makeBatches');
  const canRecordDamage = can(profile.role, 'recordDamage');
  const canCorrectStock = can(profile.role, 'correctStock');
  const production = section === 'production';
  const reports = section === 'production-report';
  const purchasing = section === 'raw-material-orders';
  const detail = section === 'raw-material-detail';
  const materialsList = !production && !purchasing && !reports && !detail;

  const close = () => setDialog(null);
  const save = (action) => (values, key) => onCommand(action, values, key);
  const mat = (id) => materials.find((m) => m.id === id);
  const prod = (id) => products.find((p) => p.id === id);
  const worker = (id) => staff.find((s) => s.id === id)?.name || 'Staff account';
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || 'Supplier';

  const unfinished = batches.filter((b) => ['Queued', 'In Progress', 'Quality Check'].includes(b.status));
  const claims = materialOrders.filter((o) => o.claim_status === 'Needs review');
  const waitingOrders = materialOrders.filter((o) => !['Arrived', 'Cancelled'].includes(o.status));

  /**
   * The header's second line is the count that matters ON THIS SCREEN. It used
   * to be the same "N raw materials · N unfinished batches" on all four, which
   * told a manager reading the damage report about a number they had not asked
   * for and left the one they had asked for off the screen.
   */
  const contextLine = purchasing
    ? `${waitingOrders.length} ${waitingOrders.length === 1 ? 'delivery' : 'deliveries'} still coming · ${claims.length} ${claims.length === 1 ? 'claim needs' : 'claims need'} review`
    : production
      ? `${unfinished.length} unfinished ${unfinished.length === 1 ? 'batch' : 'batches'}`
      : reports
        ? `${defects.length} damage ${defects.length === 1 ? 'record' : 'records'}`
        : `${materials.length} raw ${materials.length === 1 ? 'material' : 'materials'}`;

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(contextLine);
  }, [contextLine, isLoaded, onContext]);

  const sections = useMemo(() => SECTIONS.filter((s) => manager || !s.managerOnly), [manager]);

  const matches = (haystack) => haystack.toLowerCase().includes(query.trim().toLowerCase());

  /**
   * The record a command just changed, held in view even when it no longer
   * belongs there.
   *
   * MOST WORKSHOP COMMANDS FINISH A RECORD. Receiving a delivery turns it into
   * "Arrived & verified"; completing a batch turns it into "Finished". Both
   * fall straight out of the "Still waiting" filter the screen opens on, so the
   * card somebody was reading vanished at the moment it was saved, with no
   * account of where it went. A toast in the corner is not an account.
   *
   * So the changed record stays on the list it was on, showing its new status
   * pill, until the person leaves the screen (App clears the mark on navigate).
   * It is not pretending to be unfinished — the pill says exactly what it now
   * is — and the filter counts, which are computed from the unfiltered set,
   * already report the real totals beside every chip.
   */
  const justChanged = (kind, id) => Boolean(change && change.kind === kind && change.id === id);

  const toReorder = materials.filter((m) => needsReorder(m, batches));
  const displayMaterials = materials
    .filter((m) => filter !== 'reorder' || needsReorder(m, batches) || justChanged('material', m.id))
    .filter((m) => matches(`${m.name} ${m.sku}`));
  const displayOrders = materialOrders
    .filter((o) => (filter === 'all' ? true : filter === 'claims' ? o.claim_status === 'Needs review' : !['Arrived', 'Cancelled'].includes(o.status)) || justChanged('material-order', o.id))
    .filter((o) => matches(`${mat(o.raw_material_id)?.name} ${supplierName(o.supplier_id)} ${o.id}`))
    .slice()
    .reverse();
  const displayBatches = batches
    .filter((b) => filter === 'all' || !['Completed', 'Cancelled'].includes(b.status) || justChanged('batch', b.id))
    .slice()
    .reverse();
  const nextToMake = makeList({ products, inventory, orders });

  const clearSearch = () => {
    setQuery('');
    document.getElementById('workshop-search')?.focus();
  };

  const showConfirm = (action, id, status, title, description) =>
    setDialog({ kind: 'confirm', action, initial: { id, status }, title, description });

  /* -- whole-screen states ------------------------------------------------- */

  if (error) return <ErrorState onRetry={onRetry} onGoToDashboard={() => onNavigate('dashboard')} noun="workshop records" />;
  if (!isLoaded) return <LoadingState noun="workshop records" />;
  if (detail && !mat(materialId)) return <NotFoundState noun="raw material" onBack={() => onNavigate('raw-materials')} />;

  const statusMessage = purchasing
    ? `${displayOrders.length} ${displayOrders.length === 1 ? 'supplier delivery' : 'supplier deliveries'} shown.`
    : production
      ? `${displayBatches.length} ${displayBatches.length === 1 ? 'batch' : 'batches'} shown.`
      : materialsList
        ? `${displayMaterials.length} ${displayMaterials.length === 1 ? 'raw material' : 'raw materials'} shown.`
        : '';

  const material = detail ? mat(materialId) : null;

  /* -- the one solid action per screen ------------------------------------- */

  const primaryAction = production && canMake ? (
    <Button variant="clay" size="lg" className="w-full tab:w-auto" onClick={() => setDialog({ kind: 'start' })}>
      <Hammer className="h-5 w-5" />Start batch
    </Button>
  ) : purchasing && manager ? (
    <Button variant="clay" size="lg" className="w-full tab:w-auto" onClick={() => setDialog({ kind: 'order' })}>
      <Truck className="h-5 w-5" />Order materials
    </Button>
  ) : materialsList && manager ? (
    <Button variant="clay" size="lg" className="w-full tab:w-auto" onClick={() => setDialog({ kind: 'material' })}>
      <Plus className="h-5 w-5" />Add raw material
    </Button>
  ) : null;

  const filterChips = purchasing
    ? [
        { value: 'active', label: 'Still waiting', count: waitingOrders.length },
        { value: 'all', label: 'All records', count: materialOrders.length },
        { value: 'claims', label: 'Supplier claims', count: claims.length, tone: claims.length ? 'amber' : undefined },
      ]
    : production
      ? [
          { value: 'active', label: 'Still waiting', count: unfinished.length },
          { value: 'all', label: 'All records', count: batches.length },
        ]
      : materialsList
        ? [
            { value: 'all', label: 'All materials', count: materials.length },
            { value: 'reorder', label: 'Needs ordering', count: toReorder.length, tone: toReorder.length ? 'amber' : undefined },
          ]
        : null;

  /* ------------------------------------------------------------------------ */

  function renderMaterialCard(m, { standalone = true } = {}) {
    const status = materialStatus(m, batches);
    const canTransfer = manager && inventory.some((i) => i.sku.toLowerCase() === m.sku.toLowerCase() && ['sheet', 'block'].includes(i.productType));
    return (
      <Card key={m.id} className="relative flex flex-col">
        <Landed change={change} kind="material" id={m.id} />
        <CardHeader className="flex-wrap justify-between gap-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <IconChip icon={<Boxes className="h-5 w-5" />} tone={status.tone} size="md" />
            <div className="min-w-0">
              {standalone ? (
                <CardTitle>{m.name}</CardTitle>
              ) : (
                <CardTitle>On the shelf right now</CardTitle>
              )}
              <p className="pt-0.5 text-[15px] text-muted">
                <Mono>{m.sku}</Mono>
                {' · '}
                {materialKindLabel(m.material_type)}
                {m.thickness_in ? ` · ${m.thickness_in} in thick` : ''}
                {m.length_ft && m.width_ft ? ` · ${m.length_ft} × ${m.width_ft} ft` : ''}
                {m.density ? ` · ${m.density} kg/m³` : ''}
              </p>
            </div>
          </div>
          <StatusPill label={status.label} tone={status.tone} mark={status.mark} size="sm" />
        </CardHeader>

        <MaterialFigures material={m} batches={batches} />

        <RowActions>
          <Button variant="outline" onClick={() => setDialog({ kind: 'lots', material: m })}>
            <Layers className="h-4.5 w-4.5" />See received lots
          </Button>
          {standalone && (
            <Button variant="outline" onClick={() => onViewMaterial(m.id)}>
              <Package className="h-4.5 w-4.5" />View material
            </Button>
          )}
          {manager && (
            <Button variant="outline" onClick={() => setDialog({ kind: 'material', record: m })}>
              <ClipboardList className="h-4.5 w-4.5" />Change details
            </Button>
          )}
          {canRecordDamage && m.stock > 0 && (
            <Button variant="outline" onClick={() => setDialog({ kind: 'stock', mode: 'damage', material: m })}>
              <PackageX className="h-4.5 w-4.5" />Record damage
            </Button>
          )}
          {canCorrectStock && (
            <Button variant="outline" onClick={() => setDialog({ kind: 'stock', mode: 'correct', material: m })}>
              <ClipboardCheck className="h-4.5 w-4.5" />Correct the count
            </Button>
          )}
          {canTransfer && (
            <Button variant="outline" onClick={() => setDialog({ kind: 'transfer', material: m })}>
              <Boxes className="h-4.5 w-4.5" />Move selling stock here
            </Button>
          )}
        </RowActions>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p role="status" aria-live="polite" className="sr-only">{statusMessage}</p>

      <SectionTabs section={section} sections={sections} onNavigate={onNavigate} />

      {/* The tab strip is the thing that stays put; what changes is everything
          under it, so that is what arrives. Keyed by section rather than left to
          the route remount, because it states the intent: a new section is a new
          panel, and a filter or a search keystroke is not. 200ms, no stagger —
          nobody on a workshop floor should be waiting for four cards to deal
          themselves out before they can read a stock count. */}
      <div key={section} className="lsb-rise flex flex-col gap-3.5">
      {detail && material && (
        <div className="flex flex-col gap-2.5 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3.5 self-start text-muted hover:text-ink"
            onClick={() => onNavigate('raw-materials')}
          >
            <ArrowLeft className="h-5 w-5" />Back to raw materials
          </Button>
          <h2 className="text-[23px] font-extrabold tracking-[-0.02em] text-ink">{material.name}</h2>
        </div>
      )}

      {(materialsList || purchasing || production) && (
        <div className="flex flex-col gap-3 tab:flex-row tab:items-center tab:justify-between">
          <FilterBar className="min-w-0 flex-1">
            {!production && (materials.length > 0 || query) && (
              <SearchField
                id="workshop-search"
                value={query}
                onChange={setQuery}
                placeholder={purchasing ? 'Search by material, supplier or order number' : 'Search by material name or code'}
              />
            )}
            {filterChips && (
              <FilterChips
                chips={filterChips}
                value={filter}
                onChange={setFilter}
                label={purchasing ? 'Which deliveries to show' : production ? 'Which batches to show' : 'Which materials to show'}
              />
            )}
          </FilterBar>
          {primaryAction}
        </div>
      )}

      {/* -- raw materials ---------------------------------------------------- */}

      {/* None of these empty states repeats the screen's own action button. It
          sits a few pixels above them, and offering it twice put a second solid
          button in a second accent colour on a screen that has one of each. */}
      {materialsList && (
        displayMaterials.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No raw materials yet"
            description="Add the sheets, blocks and supplies the workshop builds with, so the floor and the office are counting the same stock."
            query={query.trim()}
            onClearSearch={clearSearch}
            filtered={filter !== 'all'}
            onClearFilters={() => setFilter('all')}
          />
        ) : (
          <div className="grid gap-3.5 lg:grid-cols-2">
            {displayMaterials.map((m) => renderMaterialCard(m))}
          </div>
        )
      )}

      {/* -- one raw material ------------------------------------------------- */}

      {detail && material && (
        <div className="flex flex-col gap-3.5">
          {renderMaterialCard(material, { standalone: false })}
          <SectionCard title="Stock history">
            <MaterialHistory material={material} />
          </SectionCard>
          <SectionCard title="Where this material was used">
            {(() => {
              const rows = usage.filter((u) => lots.some((l) => l.id === u.lot_id && l.raw_material_id === materialId));
              if (rows.length === 0) {
                return (
                  <p className="px-5.5 py-6 text-[15.5px] text-muted">
                    Nothing has been made from this material yet. Each finished batch records the lots it used.
                  </p>
                );
              }
              return (
                <>
                  <RowList>
                    {rows.map((u) => (
                      <Row key={u.id}>
                        <span className="flex min-w-0 items-center gap-3.5">
                          <IconChip icon={<Hammer className="h-4.5 w-4.5" />} tone="clay" size="sm" />
                          <span className="min-w-0">
                            <span className="block font-bold text-ink">{batches.find((b) => b.id === u.batch_id)?.batch_code}</span>
                            <span className="block text-[15px] text-muted">From lot #{u.lot_id}</span>
                          </span>
                        </span>
                        <span className="font-bold tabular-nums text-ink">{units(u.quantity, material.unit)}</span>
                      </Row>
                    ))}
                  </RowList>
                  <p className="border-t border-hair bg-paper-2 px-5.5 py-3.5 text-[15px] text-muted">
                    Each completed batch records the received lots it used, oldest first.
                  </p>
                </>
              );
            })()}
          </SectionCard>
        </div>
      )}

      {/* -- supplier deliveries ---------------------------------------------- */}

      {purchasing && (
        displayOrders.length === 0 ? (
          <EmptyState
            icon={<Truck />}
            title="No supplier deliveries yet"
            description="Order materials from a supplier and the promised delivery will wait here until somebody counts it in."
            query={query.trim()}
            onClearSearch={clearSearch}
            filtered={filter !== 'active'}
            onClearFilters={() => setFilter('active')}
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            {displayOrders.map((o) => {
              const status = MATERIAL_ORDER_TONE[o.status] ?? { tone: 'neutral', mark: 'dot' };
              const unit = mat(o.raw_material_id)?.unit;
              return (
                <Card key={o.id} className="relative">
                  <Landed change={change} kind="material-order" id={o.id} />
                  <CardHeader className="flex-wrap justify-between gap-3.5">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <IconChip icon={<Truck className="h-5 w-5" />} tone={status.tone} size="md" />
                      <div className="min-w-0">
                        <CardTitle>{mat(o.raw_material_id)?.name}</CardTitle>
                        <p className="pt-0.5 text-[15px] text-muted">
                          {supplierName(o.supplier_id)} · <Mono>Order #{o.id}</Mono>
                          {o.delivery_reference ? <> · Their reference <Mono>{o.delivery_reference}</Mono></> : null}
                        </p>
                      </div>
                    </div>
                    <StatusPill label={MATERIAL_ORDER_LABEL[o.status]} tone={status.tone} mark={status.mark} size="sm" />
                  </CardHeader>

                  <div className="flex flex-col gap-1.5 px-5.5 py-4.5 text-[15.5px]">
                    <p>
                      <strong className="font-bold tabular-nums text-ink">{units(o.quantity_ordered, unit)}</strong> ordered
                      {' · '}{formatPeso(o.unit_price)} each
                      {' · '}<strong className="font-bold tabular-nums text-ink">{formatPeso(o.total_cost)}</strong> total
                    </p>
                    <p className="text-muted">
                      Promised: {o.expected_delivery_date ? formatShortDate(o.expected_delivery_date) : 'Date not set'}
                      {o.actual_delivery_date ? ` · Arrived: ${formatShortDate(o.actual_delivery_date)}` : ''}
                    </p>
                    {o.carrier_notes && <p className="whitespace-pre-wrap pt-1 text-muted">{o.carrier_notes}</p>}
                    {o.status === 'Arrived' && (
                      <p className="pt-1">
                        {o.quantity_arrived} arrived − {o.quantity_lost_transit} damaged ={' '}
                        <strong className="font-bold tabular-nums text-ink">{o.quantity_usable} usable {pluralUnit(unit, o.quantity_usable)}</strong>.
                        {' '}Received by {worker(o.received_by_staff_id)}.
                      </p>
                    )}
                  </div>

                  {o.claim_status === 'Needs review' && (
                    <div className="px-5.5 pb-4.5">
                      {/* Only the clauses that are actually true. A delivery that
                          arrived complete but damaged was opening with
                          "Short by 0", which reads as a second problem. */}
                      <Callout tone="amber" title="This delivery does not match the order">
                        {[
                          o.quantity_ordered > o.quantity_arrived ? `${o.quantity_ordered - o.quantity_arrived} short of the ${o.quantity_ordered} ordered` : null,
                          o.quantity_arrived > o.quantity_ordered ? `${o.quantity_arrived - o.quantity_ordered} more than the ${o.quantity_ordered} ordered` : null,
                          o.quantity_lost_transit > 0 ? `${o.quantity_lost_transit} damaged in transit` : null,
                        ].filter(Boolean).join(' · ')}.
                        {o.transit_loss_reason ? ` ${o.transit_loss_reason}.` : ''} A manager needs to record how it was settled with the supplier.
                      </Callout>
                    </div>
                  )}
                  {o.claim_status === 'Resolved' && (
                    <div className="px-5.5 pb-4.5">
                      <Callout tone="green" title="Supplier claim settled">
                        {o.claim_notes} — recorded by {worker(o.claim_reviewed_by)}.
                      </Callout>
                    </div>
                  )}

                  <RowActions>
                    {!['Arrived', 'Cancelled'].includes(o.status) && (
                      <Button variant="outline" onClick={() => setDialog({ kind: 'receive', record: o })}>
                        <Package className="h-4.5 w-4.5" />Receive delivery
                      </Button>
                    )}
                    {manager && ['Ordered', 'Delivery Scheduled'].includes(o.status) && (
                      <Button variant="outline" onClick={() => setDialog({ kind: 'order', record: o })}>
                        <ClipboardList className="h-4.5 w-4.5" />Set delivery details
                      </Button>
                    )}
                    {manager && o.status === 'Delivery Scheduled' && (
                      <Button variant="outline" onClick={() => showConfirm('order_status', o.id, 'In Transit', 'Mark delivery on the way', `The supplier has sent order #${o.id}. No stock is added yet.`)}>
                        <Truck className="h-4.5 w-4.5" />Mark on the way
                      </Button>
                    )}
                    {manager && o.claim_status === 'Needs review' && (
                      <Button variant="outline" onClick={() => setDialog({ kind: 'claim', record: o })}>
                        <ClipboardList className="h-4.5 w-4.5" />Review supplier claim
                      </Button>
                    )}
                    {manager && ['Ordered', 'Delivery Scheduled'].includes(o.status) && (
                      <Button variant="danger" onClick={() => showConfirm('order_status', o.id, 'Cancelled', 'Cancel supplier order', `Cancel order #${o.id}. No stock is deducted; the order history is kept.`)}>
                        Cancel order
                      </Button>
                    )}
                  </RowActions>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* -- make list -------------------------------------------------------- */}

      {production && (
        <div className="flex flex-col gap-3.5">
          {nextToMake.length > 0 && (
            <SectionCard title="Make these next — most urgent first">
              <RowList>
                {nextToMake.map(({ product, needed, urgency, tone }) => (
                  <Row key={product.id}>
                    <span className="flex min-w-0 items-center gap-3.5">
                      <IconChip icon={productIcon(product.productType, 'h-5 w-5')} tone={tone} size="md" />
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">{product.name}</span>
                        <span className="block text-[15px] text-muted">
                          Need {needed} selling {needed === 1 ? 'unit' : 'units'}
                        </span>
                      </span>
                    </span>
                    <span className="flex w-full flex-wrap items-center justify-between gap-x-2.5 gap-y-2.5 tab:w-auto tab:flex-nowrap tab:justify-end">
                      <StatusPill label={urgency} tone={tone} mark="dot" size="sm" />
                      {canMake && (
                        <Button variant="outline" onClick={() => setDialog({ kind: 'start', productId: product.id, needed: needed * (product.packSize || 1) })}>
                          <Hammer className="h-4.5 w-4.5" />Start batch
                        </Button>
                      )}
                    </span>
                  </Row>
                ))}
              </RowList>
            </SectionCard>
          )}

          {displayBatches.length === 0 ? (
            <EmptyState
              icon={<Hammer />}
              title="No batches in this view"
              description="A batch is one job on the floor: what to make, how much material to set aside, and who is making it. Start one from the make list above."
              filtered={filter !== 'active'}
              onClearFilters={() => setFilter('active')}
            />
          ) : (
            displayBatches.map((b) => {
              const status = BATCH_TONE[b.status] ?? { tone: 'neutral', mark: 'dot' };
              const batchMaterial = mat(b.raw_material_id);
              return (
                <Card key={b.id} className="relative">
                  <Landed change={change} kind="batch" id={b.id} />
                  <CardHeader className="flex-wrap justify-between gap-3.5">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <IconChip icon={<Hammer className="h-5 w-5" />} tone={status.tone} size="md" />
                      <div className="min-w-0">
                        <CardTitle>{prod(b.target_product_id)?.name}</CardTitle>
                        <p className="pt-0.5 text-[15px] text-muted"><Mono>{b.batch_code}</Mono></p>
                      </div>
                    </div>
                    <StatusPill label={BATCH_LABEL[b.status]} tone={status.tone} mark={status.mark} size="sm" />
                  </CardHeader>

                  <div className="flex flex-col gap-1.5 px-5.5 py-4.5 text-[15.5px]">
                    <p>
                      Target <strong className="font-bold tabular-nums text-ink">{b.target_output_qty} pieces</strong>
                      {batchMaterial ? <> · {units(b.raw_material_used_qty, batchMaterial.unit)} of {batchMaterial.name}</> : null}
                    </p>
                    <p className="text-muted">
                      {worker(b.assigned_staff_id)} is making it
                      {b.order_id ? ` · for order #${b.order_id}` : ' · for shelf stock'}
                    </p>
                    {b.notes && <p className="whitespace-pre-wrap pt-1 text-muted">{b.notes}</p>}
                    {b.status === 'Completed' && (
                      <p className="pt-1">
                        <strong className="font-bold tabular-nums text-ink">{b.good_output_qty} good pieces</strong> ·{' '}
                        {b.damaged_qty} nasira · Checked by {worker(b.completed_by_staff_id)}
                      </p>
                    )}
                  </div>

                  {canMake && ['Queued', 'In Progress', 'Quality Check'].includes(b.status) && (
                    <RowActions>
                      {b.status === 'Queued' && (
                        <>
                          <Button variant="outline" onClick={() => showConfirm('batch_status', b.id, 'In Progress', 'Begin making this batch', `${b.batch_code} will be marked as being made. Material remains set aside until completion.`)}>
                            <Hammer className="h-4.5 w-4.5" />Begin making
                          </Button>
                          <Button variant="danger" onClick={() => showConfirm('batch_status', b.id, 'Cancelled', 'Cancel this queued batch', `Release ${units(b.raw_material_used_qty, batchMaterial?.unit)} for other batches. No stock is deducted; batch history is kept.`)}>
                            Cancel queued batch
                          </Button>
                        </>
                      )}
                      {b.status === 'In Progress' && (
                        <Button variant="outline" onClick={() => showConfirm('batch_status', b.id, 'Quality Check', 'Send batch to quality check', `The pieces for ${b.batch_code} are ready to count and inspect. Stock will be updated after the check.`)}>
                          <ClipboardList className="h-4.5 w-4.5" />Ready for quality check
                        </Button>
                      )}
                      {b.status === 'Quality Check' && (
                        <Button variant="outline" onClick={() => setDialog({ kind: 'complete', record: b })}>
                          <ClipboardList className="h-4.5 w-4.5" />Finish batch &amp; quality check
                        </Button>
                      )}
                    </RowActions>
                  )}
                </Card>
              );
            })
          )}

          <SectionCard
            title="Usual material recipes"
            action={manager && (
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'recipe' })}>
                <Plus className="h-4.5 w-4.5" />Save a recipe
              </Button>
            )}
          >
            {recipes.length === 0 ? (
              <p className="px-5.5 py-6 text-[15.5px] text-muted">
                No recipes yet. A recipe fills in the usual material count when a batch is started; without one, a batch still takes a custom count.
              </p>
            ) : (
              <RowList>
                {recipes.map((r) => (
                  <Row key={r.id} className="relative">
                    <Landed change={change} kind="recipe" id={r.id} />
                    <span className="flex min-w-0 items-center gap-3.5">
                      <IconChip icon={<ClipboardList className="h-4.5 w-4.5" />} tone="neutral" size="sm" />
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">{prod(r.product_id)?.name}</span>
                        <span className="block text-[15px] text-muted">
                          {units(r.material_qty, mat(r.raw_material_id)?.unit)} of {mat(r.raw_material_id)?.name}
                        </span>
                      </span>
                    </span>
                    <span className="text-[15.5px] text-muted">
                      makes about <strong className="font-bold tabular-nums text-ink">{r.output_qty} pieces</strong>
                    </span>
                  </Row>
                ))}
              </RowList>
            )}
          </SectionCard>
        </div>
      )}

      {/* -- damage & yield --------------------------------------------------- */}

      {reports && (() => {
        const totals = productionTotals(batches);
        const damagedInTransit = materialOrders.reduce((n, o) => n + o.quantity_lost_transit, 0);
        return (
          <div className="flex flex-col gap-3.5">
            <SectionCard title="All completed batches">
              <div className="px-5.5 py-4.5">
                <StatTiles
                  tiles={[
                    { label: 'Good pieces', value: totals.good, hint: `of ${totals.total} processed` },
                    { label: 'Nasira / damaged', value: totals.damaged, hint: totals.damageRate === null ? 'No output yet' : `${totals.damageRate.toFixed(1)}% of what was made` },
                    { label: 'Good yield', value: totals.yield === null ? '—' : `${totals.yield.toFixed(1)}%`, hint: totals.yield === null ? 'No batch finished yet' : 'across every finished batch' },
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard title="Supplier transit issues">
              <div className="px-5.5 py-4.5">
                <p className="text-[15.5px]">
                  <strong className="font-bold tabular-nums text-ink">{units(damagedInTransit, 'material unit')}</strong> damaged on the way
                  {' · '}
                  <strong className="font-bold tabular-nums text-ink">{claims.length}</strong> {claims.length === 1 ? 'claim needs' : 'claims need'} review
                </p>
              </div>
              <RowActions>
                <Button variant="outline" onClick={() => onNavigate('raw-material-orders')}>
                  <Truck className="h-4.5 w-4.5" />Open supplier deliveries
                </Button>
              </RowActions>
            </SectionCard>

            <SectionCard title="Production damage log">
              {defects.length === 0 ? (
                <p className="px-5.5 py-6 text-[15.5px] text-muted">
                  No production damage has been recorded. Damaged pieces are counted when a batch goes through its quality check.
                </p>
              ) : (
                <RowList>
                  {defects.slice().reverse().map((d) => {
                    const b = batches.find((row) => row.id === d.batch_id);
                    const lotsUsed = usage.filter((u) => u.batch_id === d.batch_id);
                    return (
                      <li key={d.id} className="flex min-h-15.5 gap-3.5 px-5.5 py-4">
                        <IconChip icon={<Package className="h-4.5 w-4.5" />} tone="red" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink">
                            <span className="tabular-nums">{d.damaged_quantity}</span> nasira · {prod(d.product_id)?.name}
                          </p>
                          <p className="pt-0.5 text-[15px] text-muted">
                            {d.reason} · {b?.batch_code} · {worker(d.logged_by_staff_id)}
                          </p>
                          <p className="pt-0.5 text-[15px] text-muted">
                            {formatShortDate(d.logged_at)} · Material lots:{' '}
                            {lotsUsed.length ? lotsUsed.map((u) => `#${u.lot_id} (${u.quantity} used)`).join(', ') : 'none recorded'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </RowList>
              )}
            </SectionCard>
          </div>
        );
      })()}

      </div>

      {/* -- dialogs ---------------------------------------------------------- */}

      {dialog?.kind === 'material' && <MaterialDialog material={dialog.record} onSave={save('save_material')} onClose={close} />}
      {dialog?.kind === 'order' && <SupplierOrderDialog order={dialog.record} materials={materials} suppliers={suppliers} profile={profile} onSave={save('save_order')} onClose={close} />}
      {dialog?.kind === 'recipe' && <RecipeDialog products={products} materials={materials} onSave={save('save_recipe')} onClose={close} />}
      {dialog?.kind === 'transfer' && <TransferDialog material={dialog.material} inventory={inventory.find((i) => i.sku.toLowerCase() === dialog.material.sku.toLowerCase())} profile={profile} onSave={save('transfer_stock')} onClose={close} />}
      {dialog?.kind === 'receive' && <ReceiveSupplierDeliveryDialog order={dialog.record} material={mat(dialog.record.raw_material_id)} profile={profile} onSave={save('receive_delivery')} onClose={close} />}
      {dialog?.kind === 'complete' && <CompleteBatchDialog batch={dialog.record} product={prod(dialog.record.target_product_id)} inventory={inventory.find((i) => i.id === dialog.record.inventory_id)} material={mat(dialog.record.raw_material_id)} batches={batches} profile={profile} onSave={save('complete_batch')} onClose={close} />}
      {dialog?.kind === 'start' && <StartBatchDialog {...data} productId={dialog.productId} needed={dialog.needed} profile={profile} onSave={save('start_batch')} onClose={close} />}
      {dialog?.kind === 'stock' && (
        <StockChangeDialog
          mode={dialog.mode}
          target="material"
          record={{ id: dialog.material.id, name: dialog.material.name, stock: dialog.material.stock, unit: dialog.material.unit }}
          onSave={(values, key) => onStockCommand(dialog.mode === 'damage' ? 'record_damage' : 'correct_count', values, key)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'confirm' && <WorkshopConfirmation title={dialog.title} description={dialog.description} initial={dialog.initial} action="Confirm this step" profile={profile} onSave={save(dialog.action)} onClose={close} />}
      {dialog?.kind === 'claim' && <WorkshopConfirmation title="Review supplier claim" description={`Order #${dialog.record.id}. Record the agreed outcome; received stock and damage history are kept.`} initial={{ id: dialog.record.id }} action="Save claim outcome" needsReason profile={profile} onSave={save('review_claim')} onClose={close} />}
      {dialog?.kind === 'lots' && (
        <WorkshopForm
          title={`Received lots: ${dialog.material.name}`}
          description="The oldest available lot is used first when a batch finishes."
          submitLabel="Done"
          initial={{}}
          onSave={async () => ({ ok: true })}
          onClose={close}
        >
          {() => {
            const rows = lots.filter((l) => l.raw_material_id === dialog.material.id);
            if (rows.length === 0) {
              return <ReviewBox>No material has been received for {dialog.material.name} yet. A lot is created when a supplier delivery is counted in, or when selling stock is moved here.</ReviewBox>;
            }
            return (
              <ul className="divide-y divide-hair">
                {rows.map((l) => (
                  <li key={l.id} className="flex min-h-15.5 flex-wrap items-center justify-between gap-3 py-4">
                    <span>
                      <span className="block font-bold text-ink">Lot #{l.id}</span>
                      <span className="block text-muted">{l.source}{l.order_id ? ` · Order #${l.order_id}` : ''}</span>
                    </span>
                    <span className="font-bold tabular-nums text-ink">
                      {l.remaining} of {units(l.quantity, dialog.material.unit)} left
                    </span>
                  </li>
                ))}
              </ul>
            );
          }}
        </WorkshopForm>
      )}
    </div>
  );
}
