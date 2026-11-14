import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { Row } from '../shared/forms';
import { freeMaterial, recipeEstimate, units } from '../../utils/production';
import { countProblem } from '../../utils/validation';

/**
 * Planning a batch: what to make, and the material to set aside for it.
 *
 * ONLY WHAT CAN BE USED IS OFFERED. A material taken out of use is left off the
 * list, and one with nothing free -- used up, or every unit already set aside
 * for other batches -- is listed but cannot be chosen, with the reason in its
 * label, so it stays visible without being a trap. Products no longer sold are
 * left off. The database refuses all three as well (workshop_precheck).
 */
export default function StartBatchDialog({ products, materials, recipes, batches, staff, orders, productId, needed, profile, onSave, onClose }) {
  const onSale = products.filter((p) => p.status !== 'Archived');
  const usable = materials.filter((m) => m.status !== 'Archived');
  const recipe = recipes.find((r) => r.product_id === productId && usable.some((m) => m.id === r.raw_material_id && freeMaterial(m, batches) > 0))
    ?? recipes.find((r) => r.product_id === productId);
  const pieces = needed || recipe?.output_qty || '';
  const recipeMaterial = usable.find((m) => m.id === recipe?.raw_material_id);
  const startsWith = recipeMaterial && freeMaterial(recipeMaterial, batches) > 0 ? recipeMaterial.id : '';

  function validate(v) {
    const m = usable.find((one) => one.id === Number(v.raw_material_id));
    const free = m ? freeMaterial(m, batches) : 0;
    return {
      product_id: v.product_id ? null : 'Select a product.',
      output_qty: countProblem(v.output_qty, { min: 1, label: 'The planned quantity' }),
      raw_material_id: !m ? 'Select a raw material.'
        : free <= 0 ? `${m.name} has no stock available. Select another material or order more.` : null,
      material_qty: countProblem(v.material_qty, { min: 1, label: 'Material quantity to reserve' })
        ?? (m && Number(v.material_qty) > free
          ? `Only ${units(free, m.unit)} of ${m.name} are available. Enter ${free} or fewer.`
          : null),
      assigned_staff_id: v.assigned_staff_id ? null : 'Assign a worker.',
    };
  }

  return <WorkshopForm title="Plan a batch" description="Planning reserves the material. Stock is deducted when the batch is finished."
    submitLabel="Plan batch" initial={{ product_id: productId || '', raw_material_id: startsWith, output_qty: pieces,
      material_qty: startsWith ? recipeEstimate(recipe, pieces) : '', assigned_staff_id: profile.role === 'Production Staff' ? profile.id : '', order_id: '', notes: '' }}
    validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change, set) => {
      const selectedRecipe = recipes.find((r) => r.product_id === Number(v.product_id) && r.raw_material_id === Number(v.raw_material_id));
      const material = usable.find((m) => m.id === Number(v.raw_material_id));
      const free = material ? freeMaterial(material, batches) : 0;
      return <>
        <WorkshopField name="product_id" label="Product" required options={onSale.map((p) => ({ value: p.id, label: p.name }))} value={v.product_id} onChange={(e) => {
          const id = Number(e.target.value);
          const r = recipes.find((one) => one.product_id === id && usable.some((m) => m.id === one.raw_material_id && freeMaterial(m, batches) > 0));
          set((old) => ({ ...old, product_id: id, raw_material_id: r?.raw_material_id || '', material_qty: recipeEstimate(r, old.output_qty) }));
        }} />
        <Row>
        <WorkshopField name="output_qty" label="Planned pieces" hint="Enter the number of individual pieces." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => { const n = e.target.value; set((old) => ({ ...old, output_qty: n, ...(selectedRecipe ? { material_qty: recipeEstimate(selectedRecipe, n) } : {}) })); }} />
        <WorkshopField name="assigned_staff_id" label="Assigned worker" required options={staff.filter((s) => s.status === 'Active' && ['Admin', 'Manager', 'Production Staff'].includes(s.role)).map((s) => ({ value: s.id, label: s.name }))} value={v.assigned_staff_id} onChange={(e) => change('assigned_staff_id', e.target.value)} />
        </Row>
        <WorkshopField name="raw_material_id" label="Raw material" hint="Select a material with stock available." required
          options={usable.map((m) => {
            const left = freeMaterial(m, batches);
            return { value: m.id, disabled: left <= 0,
              label: left > 0 ? `${m.name} · ${units(left, m.unit)} in stock` : `${m.name} · ${m.stock <= 0 ? 'No stock' : 'All set aside'}` };
          })}
          value={v.raw_material_id} onChange={(e) => {
            const id = Number(e.target.value), r = recipes.find((one) => one.product_id === Number(v.product_id) && one.raw_material_id === id);
            set((old) => ({ ...old, raw_material_id: id, material_qty: recipeEstimate(r, old.output_qty) }));
          }} />
        <WorkshopField name="material_qty" label="Material quantity to reserve" hint={selectedRecipe ? `Recipe estimate based on ${units(selectedRecipe.material_qty, material?.unit)} for ${selectedRecipe.output_qty} pieces. Adjust as needed.` : material ? `${units(free, material.unit)} available. Enter the amount needed.` : 'Select a raw material first.'} type="number" inputMode="numeric" min="1" max={material ? Math.max(1, free) : undefined} step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        <WorkshopField name="order_id" label="Customer order" hint="Leave blank for shelf stock." placeholder="None (shelf stock)" options={orders.filter((o) => o.status === 'Pending').map((o) => ({ value: o.id, label: `Order #${o.id} · ${o.customerName ?? ''}`.replace(/ · $/, '') }))} value={v.order_id} onChange={(e) => change('order_id', e.target.value)} />
        <WorkshopField name="notes" label="Notes" hint="Optional. Add any custom dimensions or production instructions." multiline maxLength={1000} value={v.notes} onChange={(e) => change('notes', e.target.value)} />
        <ReviewBox>
          {material && Number(v.material_qty) > 0
            ? <>Reserves {units(Number(v.material_qty), material.unit)} of {material.name}. {units(Math.max(0, free - Number(v.material_qty)), material.unit)} will remain available.</>
            : 'Select a material and enter a quantity to see what will be reserved.'}
          <p>Planned by {profile.name}.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
