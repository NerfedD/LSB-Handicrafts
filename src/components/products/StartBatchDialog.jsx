import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
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
      product_id: v.product_id ? null : 'Choose what is being made.',
      output_qty: countProblem(v.output_qty, { min: 1, label: 'The target' }),
      raw_material_id: !m ? 'Choose the material this batch uses.'
        : free <= 0 ? `${m.name} has none free. Order more, or choose another material.` : null,
      material_qty: countProblem(v.material_qty, { min: 1, label: 'The material to set aside' })
        ?? (m && Number(v.material_qty) > free
          ? `Only ${units(free, m.unit)} of ${m.name} are free after other batches. Set aside ${free} or fewer.`
          : null),
      assigned_staff_id: v.assigned_staff_id ? null : 'Choose who will make it.',
    };
  }

  return <WorkshopForm title="Start a batch" description="Plan what to make and set the material aside. Stock is deducted only when the batch is finished."
    submitLabel="Plan this batch" initial={{ product_id: productId || '', raw_material_id: startsWith, output_qty: pieces,
      material_qty: startsWith ? recipeEstimate(recipe, pieces) : '', assigned_staff_id: profile.role === 'Production Staff' ? profile.id : '', order_id: '', notes: '' }}
    validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change, set) => {
      const selectedRecipe = recipes.find((r) => r.product_id === Number(v.product_id) && r.raw_material_id === Number(v.raw_material_id));
      const material = usable.find((m) => m.id === Number(v.raw_material_id));
      const free = material ? freeMaterial(material, batches) : 0;
      return <>
        <WorkshopField name="product_id" label="What are we making?" hint="The finished item that will go on the shelf." required options={onSale.map((p) => ({ value: p.id, label: p.name }))} value={v.product_id} onChange={(e) => {
          const id = Number(e.target.value);
          const r = recipes.find((one) => one.product_id === id && usable.some((m) => m.id === one.raw_material_id && freeMaterial(m, batches) > 0));
          set((old) => ({ ...old, product_id: id, raw_material_id: r?.raw_material_id || '', material_qty: recipeEstimate(r, old.output_qty) }));
        }} />
        <WorkshopField name="output_qty" label="Target pieces" hint="Count individual pieces, even when they are sold in packs. A whole number." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => { const n = e.target.value; set((old) => ({ ...old, output_qty: n, ...(selectedRecipe ? { material_qty: recipeEstimate(selectedRecipe, n) } : {}) })); }} />
        <WorkshopField name="raw_material_id" label="Which raw material?" hint="Counts allow for other unfinished batches. A material with none free cannot be chosen: order more under Purchasing first." required
          options={usable.map((m) => {
            const left = freeMaterial(m, batches);
            return { value: m.id, disabled: left <= 0,
              label: left > 0 ? `${m.name} · ${units(left, m.unit)} free` : `${m.name} · none free${m.stock <= 0 ? ' (out of stock)' : ' (all set aside)'}` };
          })}
          value={v.raw_material_id} onChange={(e) => {
            const id = Number(e.target.value), r = recipes.find((one) => one.product_id === Number(v.product_id) && one.raw_material_id === id);
            set((old) => ({ ...old, raw_material_id: id, material_qty: recipeEstimate(r, old.output_qty) }));
          }} />
        <WorkshopField name="material_qty" label="Material to set aside" hint={selectedRecipe ? `Recipe: ${units(selectedRecipe.material_qty, material?.unit)} make about ${selectedRecipe.output_qty} pieces. Change it for this job if needed.` : material ? `Up to ${units(free, material.unit)} free. No recipe yet, so enter what this job needs.` : 'Choose the material first.'} type="number" inputMode="numeric" min="1" max={material ? Math.max(1, free) : undefined} step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        <WorkshopField name="assigned_staff_id" label="Who will make it?" hint="The worker responsible for this batch." required options={staff.filter((s) => s.status === 'Active' && ['Admin', 'Manager', 'Production Staff'].includes(s.role)).map((s) => ({ value: s.id, label: s.name }))} value={v.assigned_staff_id} onChange={(e) => change('assigned_staff_id', e.target.value)} />
        <WorkshopField name="order_id" label="Customer order, if any" hint="Leave blank when making shelf stock." placeholder="None: for shelf stock" options={orders.filter((o) => o.status === 'Pending').map((o) => ({ value: o.id, label: `Order #${o.id} · ${o.customerName ?? ''}`.replace(/ · $/, '') }))} value={v.order_id} onChange={(e) => change('order_id', e.target.value)} />
        <WorkshopField name="notes" label="Instructions for this batch" hint="Optional: a custom size, event details or changes to the recipe." multiline maxLength={1000} value={v.notes} onChange={(e) => change('notes', e.target.value)} />
        <ReviewBox>
          {material && Number(v.material_qty) > 0
            ? <>Sets aside {units(Number(v.material_qty), material.unit)} of {material.name}, leaving {units(Math.max(0, free - Number(v.material_qty)), material.unit)} free. Nothing is deducted until the batch is finished and checked.</>
            : 'The material chosen here is set aside for this batch. Nothing is deducted from stock until the batch is finished and checked.'}
          <p>Planned by {profile.name}. The batch appears under Production as Planned.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
