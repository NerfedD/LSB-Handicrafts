import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { freeMaterial, units } from '../../utils/production';
import { countProblem } from '../../utils/validation';

/**
 * Correcting an unfinished batch: its counts, who makes it, the order it is
 * for, and its notes. A manager's job (correctBatches).
 *
 * THE PRODUCT AND THE MATERIAL change only once an undo has released the
 * batch's material: a different product or material is a different shelf row
 * and a different reservation, and nothing is held for it until the batch
 * moves forward again (the database checks the material then). While the
 * material is held, free material is counted without this batch's own share,
 * so its current amount always fits.
 */
export default function EditBatchDialog({ batch, product, material, products = [], materials = [], inventory = [], batches, staff, orders, profile, onSave, onClose }) {
  const free = material ? freeMaterial(material, batches, batch.id) : 0;
  const released = batch.material_reserved === false;
  const waiting = orders.filter((o) => o.status === 'Pending');
  const orderStillWaiting = waiting.some((o) => o.id === batch.order_id);

  function validate(v) {
    return {
      output_qty: countProblem(v.output_qty, { min: 1, label: 'The planned quantity' }),
      material_qty: countProblem(v.material_qty, { min: 1, label: 'Material quantity to reserve' })
        ?? (!released && material && Number(v.material_qty) > free
          ? `Only ${units(free, material.unit)} of ${material.name} are available. Enter ${free} or fewer.`
          : null),
      assigned_staff_id: v.assigned_staff_id ? null : 'Assign a worker.',
    };
  }

  return <WorkshopForm title={`Edit ${batch.batch_code}`}
    description={released
      ? 'Update the product, material, or planned quantity.'
      : `${product?.name ?? 'This product'} from ${material?.name ?? 'its material'}. Undo the last step to release the reservation before changing the product or material.`}
    submitLabel="Save changes"
    initial={{ id: batch.id, expectedRevision: batch.revision ?? 0, output_qty: String(batch.target_output_qty), material_qty: String(batch.raw_material_used_qty),
      ...(released ? { product_id: batch.target_product_id, raw_material_id: batch.raw_material_id } : {}),
      assigned_staff_id: batch.assigned_staff_id, order_id: orderStillWaiting ? batch.order_id : '', notes: batch.notes ?? '' }}
    validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {released && <>
        <WorkshopField name="product_id" label="Product" required value={v.product_id} onChange={(e) => change('product_id', e.target.value)}
          options={products.filter((p) => p.status !== 'Archived' && inventory.some((i) => i.sku.toLowerCase() === p.itemCode.toLowerCase())).map((p) => ({ value: p.id, label: p.name }))} />
        <WorkshopField name="raw_material_id" label="Raw material" required value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)}
          options={materials.filter((m) => m.status !== 'Archived').map((m) => ({ value: m.id, label: m.name }))} />
      </>}
      <WorkshopField name="output_qty" label="Planned pieces" hint="Enter the number of individual pieces." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => change('output_qty', e.target.value)} />
      <WorkshopField name="material_qty" label="Material quantity to reserve" hint={released ? 'Enter the quantity in the selected material’s stock unit.' : material ? `${units(free, material.unit)} available for this batch.` : undefined} type="number" inputMode="numeric" min="1" max={released ? 2000000000 : Math.max(1, free)} step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
      <WorkshopField name="assigned_staff_id" label="Assigned worker" required options={staff.filter((s) => s.status === 'Active' && ['Admin', 'Manager', 'Production Staff'].includes(s.role)).map((s) => ({ value: s.id, label: s.name }))} value={v.assigned_staff_id} onChange={(e) => change('assigned_staff_id', e.target.value)} />
      <WorkshopField name="order_id" label="Customer order" hint="Leave blank for shelf stock." placeholder="None (shelf stock)" options={waiting.map((o) => ({ value: o.id, label: `Order #${o.id} · ${o.customerName ?? ''}`.replace(/ · $/, '') }))} value={v.order_id} onChange={(e) => change('order_id', e.target.value)} />
      <WorkshopField name="notes" label={<>Notes <span className="font-normal text-muted-fg">(optional)</span></>} hint="Add any custom dimensions or production instructions." multiline maxLength={1000} value={v.notes} onChange={(e) => change('notes', e.target.value)} />
      <ReviewBox>
        {batch.order_id && !orderStillWaiting && <p>Order #{batch.order_id} is no longer pending. Select another order or leave the field blank for shelf stock.</p>}
        {released
          ? <p>The material will be reserved when you resume the batch.</p>
          : material && Number(v.material_qty) > 0
            ? <>Sets aside {units(Number(v.material_qty), material.unit)} of {material.name} for this batch. Nothing is deducted until it is finished.</>
            : 'Nothing is deducted from stock until the batch is finished.'}
        <p>The activity log will record this change under {profile.name}.</p>
      </ReviewBox>
    </>}
  </WorkshopForm>;
}
