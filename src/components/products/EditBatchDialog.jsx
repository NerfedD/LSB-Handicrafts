import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { freeMaterial, units } from '../../utils/production';
import { countProblem } from '../../utils/validation';

/**
 * Correcting an unfinished batch: its counts, who makes it, the order it is
 * for, and its notes. A manager's job (correctBatches).
 *
 * THE PRODUCT AND THE MATERIAL ARE NOT HERE. Changing either is a different
 * batch, with a different shelf row and a different reservation, so the honest
 * correction is to cancel this one and plan the right one -- which the help
 * line says. Free material is counted without this batch's own share, so its
 * current amount always fits.
 */
export default function EditBatchDialog({ batch, product, material, batches, staff, orders, profile, onSave, onClose }) {
  const free = material ? freeMaterial(material, batches, batch.id) : 0;
  const waiting = orders.filter((o) => o.status === 'Pending');
  const orderStillWaiting = waiting.some((o) => o.id === batch.order_id);

  function validate(v) {
    return {
      output_qty: countProblem(v.output_qty, { min: 1, label: 'The target' }),
      material_qty: countProblem(v.material_qty, { min: 1, label: 'The material to set aside' })
        ?? (material && Number(v.material_qty) > free
          ? `Only ${units(free, material.unit)} of ${material.name} are free after other batches. Set aside ${free} or fewer.`
          : null),
      assigned_staff_id: v.assigned_staff_id ? null : 'Choose who will make it.',
    };
  }

  return <WorkshopForm title={`Edit ${batch.batch_code}`}
    description={`${product?.name ?? 'This product'} from ${material?.name ?? 'its material'}. To make a different product or use a different material, cancel this batch and start a new one.`}
    submitLabel="Save changes"
    initial={{ id: batch.id, output_qty: String(batch.target_output_qty), material_qty: String(batch.raw_material_used_qty),
      assigned_staff_id: batch.assigned_staff_id, order_id: orderStillWaiting ? batch.order_id : '', notes: batch.notes ?? '' }}
    validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField name="output_qty" label="How many" hint="Pieces, even when they are sold in packs." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => change('output_qty', e.target.value)} />
      <WorkshopField name="material_qty" label="Material to set aside" hint={material ? `Up to ${units(free, material.unit)} of ${material.name}, counting what other batches have set aside.` : 'The material this batch was planned with.'} type="number" inputMode="numeric" min="1" max={Math.max(1, free)} step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
      <WorkshopField name="assigned_staff_id" label="Made by" required options={staff.filter((s) => s.status === 'Active' && ['Admin', 'Manager', 'Production Staff'].includes(s.role)).map((s) => ({ value: s.id, label: s.name }))} value={v.assigned_staff_id} onChange={(e) => change('assigned_staff_id', e.target.value)} />
      <WorkshopField name="order_id" label="For order" hint="Leave blank when making shelf stock." placeholder="None: for shelf stock" options={waiting.map((o) => ({ value: o.id, label: `Order #${o.id} · ${o.customerName ?? ''}`.replace(/ · $/, '') }))} value={v.order_id} onChange={(e) => change('order_id', e.target.value)} />
      <WorkshopField name="notes" label={<>Notes <span className="font-normal text-muted-fg">(optional)</span></>} hint="A custom size, event details or changes to the recipe." multiline maxLength={1000} value={v.notes} onChange={(e) => change('notes', e.target.value)} />
      <ReviewBox>
        {batch.order_id && !orderStillWaiting && <p>Order #{batch.order_id} is no longer waiting, so this batch will be for shelf stock unless another order is chosen.</p>}
        {material && Number(v.material_qty) > 0
          ? <>Sets aside {units(Number(v.material_qty), material.unit)} of {material.name} for this batch. Nothing is deducted until it is finished.</>
          : 'Nothing is deducted from stock until the batch is finished.'}
        <p>Changed by {profile.name}. This is saved in the activity log.</p>
      </ReviewBox>
    </>}
  </WorkshopForm>;
}
