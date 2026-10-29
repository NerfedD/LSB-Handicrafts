import { useState } from 'react';

import { Button } from '@/components/ui/button';
import Callout from '../shared/Callout';
import ConfirmDialog from '../shared/ConfirmDialog';
import { ErrorState, LoadingState, NotFoundState } from '../shared/PageStates';
import { Page } from '../shared/page';
import { can } from '../../utils/permissions';
import { units } from '../../utils/production';
import { makeList } from '../../utils/dashboard';
import WorkshopForm, { ReviewBox } from './WorkshopForm';
import { MaterialDialog, RecipeDialog, SupplierOrderDialog, TransferDialog, WorkshopConfirmation } from './WorkshopEditors';
import ReceiveSupplierDeliveryDialog from '../suppliers/ReceiveSupplierDeliveryDialog';
import CompleteBatchDialog from '../products/CompleteBatchDialog';
import EditBatchDialog from '../products/EditBatchDialog';
import StartBatchDialog from '../products/StartBatchDialog';
import StockChangeDialog from '../products/StockChangeDialog';
import BatchesSection from './BatchesSection';
import MaterialsSection, { MaterialDetail } from './MaterialsSection';
import PurchasingSection from './PurchasingSection';
import ReportSection from './ReportSection';

/**
 * The workshop's screens, one per Production sub-item on the sidebar:
 * Batches, Raw materials (and one material's own screen), Purchasing and the
 * Production report, each drawn to its board in its own section file.
 *
 * This component owns what they share: the data, who may do what, and every
 * dialog a section can open. A section asks for one through `ws.setDialog`.
 */
export default function WorkshopPage({ section, materialId, onViewMaterial, profile, data, isLoaded, error, onRetry, onCommand, onStockCommand, onRemoveMaterial, onRestoreMaterial, onNavigate, change, initialFilter }) {
  const { materials, materialOrders, batches, recipes, defects, lots, usage, products, inventory, orders, suppliers, staff } = data;
  const [dialog, setDialog] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [now] = useState(() => Date.now());

  const manager = can(profile.role, 'manageSuppliers');
  const purchasing = section === 'raw-material-orders';
  const detail = section === 'raw-material-detail';

  const close = () => setDialog(null);
  const save = (action) => (values, key) => onCommand(action, values, key);
  const mat = (id) => materials.find((m) => m.id === id);
  const prod = (id) => products.find((p) => p.id === id);
  const worker = (id) => staff.find((s) => s.id === id)?.name || 'Staff account';
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || 'Supplier';
  const inUse = materials.filter((m) => m.status !== 'Archived');

  /**
   * The record a command just changed stays in view on the list it was on,
   * showing its new status, until the person leaves the screen -- even when
   * the filter would now hide it.
   */
  const justChanged = (kind, id) => Boolean(change && change.kind === kind && change.id === id);

  const ws = {
    section, materials, materialOrders, batches, recipes, defects, lots, usage, products, inventory, orders, suppliers, staff,
    manager,
    canMake: can(profile.role, 'makeBatches'),
    canRecordDamage: can(profile.role, 'recordDamage'),
    canCorrectStock: can(profile.role, 'correctStock'),
    canUndoDamage: can(profile.role, 'undoDamage'),
    canRemoveRecords: can(profile.role, 'removeRecords'),
    canCorrect: can(profile.role, 'correctBatches'),
    canSeeReport: can(profile.role, 'viewReports'),
    mat, prod, worker, supplierName, justChanged, change, now, initialFilter,
    query, setQuery,
    // Products still sold only: a removed product must not keep asking to be made.
    nextToMake: makeList({ products: products.filter((p) => p.status !== 'Archived'), inventory, orders }),
    setDialog, setRemoving, working,
    showConfirm: (action, id, status, title, description) => setDialog({ kind: 'confirm', action, initial: { id, status }, title, description }),
    askWhy: (action, id, { title, description, verb, question }) => setDialog({ kind: 'correct', action, id, title, description, verb, question }),
    onNavigate, onViewMaterial, onStockCommand,
    restoreMaterial: async (material) => {
      setWorking(true);
      await onRestoreMaterial?.(material);
      setWorking(false);
    },
  };

  if (error) return <Page><ErrorState onRetry={onRetry} onGoToDashboard={() => onNavigate('dashboard')} noun="workshop records" /></Page>;
  if (!isLoaded) return <Page><LoadingState noun="workshop records" /></Page>;
  if (detail && !mat(materialId)) return <NotFoundState noun="raw material" onBack={() => onNavigate('raw-materials')} />;

  const material = detail ? mat(materialId) : null;

  return (
    <>
      {notice ? (
        <div className="px-4 pt-4">
          <Callout
            tone="green"
            title={notice.title}
            action={(
              <>
                <Button variant="outline" size="sm" onClick={() => onNavigate('raw-material-orders')}>Open Purchasing</Button>
                <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
              </>
            )}
          >
            {notice.text}
          </Callout>
        </div>
      ) : null}

      {section === 'production' ? <BatchesSection ws={ws} /> : null}
      {section === 'raw-materials' ? <MaterialsSection ws={ws} /> : null}
      {detail && material ? <MaterialDetail ws={ws} material={material} /> : null}
      {purchasing ? <PurchasingSection ws={ws} /> : null}
      {section === 'production-report' ? <ReportSection ws={ws} /> : null}

      {/* -- dialogs ---------------------------------------------------------- */}

      {dialog?.kind === 'material' && <MaterialDialog material={dialog.record} materials={materials} onSave={save('save_material')} onClose={close} />}
      {detail && material && (
        <ConfirmDialog
          open={removing}
          onOpenChange={(next) => !next && setRemoving(false)}
          title={`Remove ${material.name}?`}
          consequences={
            <>
              It stops appearing in the materials list, on new supplier orders and in
              recipes. Anything that has happened to it is kept, and a material with
              history or stock can be put back in use. Finished batches and deliveries
              keep their records exactly as written.
            </>
          }
          confirmLabel="Yes, remove it"
          busy={working}
          onConfirm={async () => {
            setWorking(true);
            await onRemoveMaterial?.(material);
            setWorking(false);
            setRemoving(false);
          }}
        />
      )}
      {dialog?.kind === 'order' && <SupplierOrderDialog order={dialog.record} preset={dialog.preset} materials={inUse} suppliers={suppliers} profile={profile}
        onSave={async (values, key) => {
          const result = await onCommand('save_order', values, key);
          // Ordered from the materials screen: say where the order went, and
          // offer the way there, rather than leaving it to be guessed.
          if (result.ok && !purchasing && !dialog.record) {
            setNotice({ title: `Order #${result.data.id} was saved`, text: 'It is on the Purchasing screen until the delivery is received. Stock is added when it is counted in.' });
          }
          return result;
        }} onClose={close} />}
      {dialog?.kind === 'recipe' && <RecipeDialog products={products.filter((p) => p.status !== 'Archived')} materials={inUse} onSave={save('save_recipe')} onClose={close} />}
      {dialog?.kind === 'transfer' && <TransferDialog material={dialog.material} inventory={inventory.find((i) => i.sku.toLowerCase() === dialog.material.sku.toLowerCase())} profile={profile} onSave={save('transfer_stock')} onClose={close} />}
      {dialog?.kind === 'receive' && <ReceiveSupplierDeliveryDialog order={dialog.record} material={mat(dialog.record.raw_material_id)} supplier={dialog.record.supplier_id ? supplierName(dialog.record.supplier_id) : null} profile={profile} onSave={save('receive_delivery')} onClose={close} />}
      {dialog?.kind === 'complete' && <CompleteBatchDialog batch={dialog.record} product={prod(dialog.record.target_product_id)} inventory={inventory.find((i) => i.id === dialog.record.inventory_id)} material={mat(dialog.record.raw_material_id)} batches={batches} profile={profile} onSave={save('complete_batch')} onClose={close} />}
      {dialog?.kind === 'start' && <StartBatchDialog {...data} productId={dialog.productId} needed={dialog.needed} profile={profile} onSave={save('start_batch')} onClose={close} />}
      {dialog?.kind === 'stock' && (
        <StockChangeDialog
          mode={dialog.mode}
          target="material"
          record={{ id: dialog.material.id, name: dialog.material.name, stock: dialog.material.stock, unit: dialog.material.unit }}
          canCorrect={can(profile.role, 'correctStock')}
          canDamage={can(profile.role, 'recordDamage')}
          onSave={(values, key, mode = dialog.mode) => onStockCommand(mode === 'damage' ? 'record_damage' : 'correct_count', values, key)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'confirm' && <WorkshopConfirmation title={dialog.title} description={dialog.description} initial={dialog.initial} action="Confirm this step" profile={profile} onSave={save(dialog.action)} onClose={close} />}
      {dialog?.kind === 'correct' && <WorkshopConfirmation title={dialog.title} description={dialog.description} initial={{ id: dialog.id }} action={dialog.verb} danger needsReason
        reasonLabel={dialog.question} reasonHint="A sentence is enough. It is saved in the activity log with your name." reasonMissing="Write why, so the activity log explains it." reasonMax={500}
        profile={profile} onSave={save(dialog.action)} onClose={close} />}
      {dialog?.kind === 'edit-batch' && <EditBatchDialog batch={dialog.record} product={prod(dialog.record.target_product_id)} material={mat(dialog.record.raw_material_id)} batches={batches} staff={staff} orders={orders} profile={profile} onSave={save('edit_batch')} onClose={close} />}
      {dialog?.kind === 'claim' && <WorkshopConfirmation title={`Settle the order #${dialog.record.id} claim`} description={`${mat(dialog.record.raw_material_id)?.name ?? 'Material'} from ${supplierName(dialog.record.supplier_id)}. Received stock and the damage history are kept.`} initial={{ id: dialog.record.id }} action="Close the claim" cancelLabel="Keep it open" needsReason reasonLabel="How it was settled" reasonHint="A replacement, a credit on the next order, a refund, or the loss absorbed. A replacement is ordered and received as a new order." profile={profile} onSave={save('review_claim')} onClose={close} />}
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
              <ul className="m-0 list-none p-0">
                {rows.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-row-divider py-2.5 text-13 first:border-t-0">
                    <span>
                      <span className="block font-medium">Lot #{l.id}</span>
                      <span className="block text-muted-fg">{l.source}{l.order_id ? ` · Order #${l.order_id}` : ''}</span>
                    </span>
                    <span className="font-medium">
                      {l.remaining} of {units(l.quantity, dialog.material.unit)} left
                    </span>
                  </li>
                ))}
              </ul>
            );
          }}
        </WorkshopForm>
      )}
    </>
  );
}
