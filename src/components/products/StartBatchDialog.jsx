import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { availableMaterial, countValue, freeMaterial, recipeEstimate, units } from '../../utils/production';

export default function StartBatchDialog({ products, materials, recipes, batches, staff, orders, productId, needed, profile, onSave, onClose }) {
  const recipe = recipes.find((r) => r.product_id === productId);
  const pieces = needed || recipe?.output_qty || '';
  return <WorkshopForm title="Start batch" description="Plan what to make and set aside the material. Stock is deducted when the batch is finished."
    submitLabel="Add batch to make list" initial={{ product_id: productId || '', raw_material_id: recipe?.raw_material_id || '', output_qty: pieces,
      material_qty: recipeEstimate(recipe, pieces), assigned_staff_id: profile.role === 'Production Staff' ? profile.id : '', order_id: '', notes: '' }}
    onSave={onSave} onClose={onClose} validate={(v) => {
      const m = materials.find((m) => m.id === Number(v.raw_material_id));
      return !m || countValue(v.material_qty, 1) === null || Number(v.material_qty) > availableMaterial(m, batches) ? 'Choose material and a whole count within the amount available.'
        : countValue(v.output_qty, 1) === null ? 'Enter a whole target count greater than zero.' : null;
    }}>
    {(v, change, set) => {
      const selectedRecipe = recipes.find((r) => r.product_id === Number(v.product_id) && r.raw_material_id === Number(v.raw_material_id));
      const material = materials.find((m) => m.id === Number(v.raw_material_id));
      return <>
        <WorkshopField label="What are we making?" hint="Choose the finished item that will go on the shelf." required options={products.map((p) => ({ value: p.id, label: p.name }))} value={v.product_id} onChange={(e) => {
          const id = Number(e.target.value), r = recipes.find((r) => r.product_id === id);
          set((old) => ({ ...old, product_id: id, raw_material_id: r?.raw_material_id || '', material_qty: recipeEstimate(r, old.output_qty) }));
        }} />
        <WorkshopField label="Target pieces" hint="Count individual pieces, even when sold in packs." type="number" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => { const n = e.target.value; set((old) => ({ ...old, output_qty: n, ...(selectedRecipe ? { material_qty: recipeEstimate(selectedRecipe, n) } : {}) })); }} />
        <WorkshopField label="Which raw material?" hint="Available counts allow for other unfinished batches." required options={materials.map((m) => ({ value: m.id, label: `${m.name} — ${units(freeMaterial(m, batches), m.unit)} available` }))} value={v.raw_material_id} onChange={(e) => {
          const id = Number(e.target.value), r = recipes.find((r) => r.product_id === Number(v.product_id) && r.raw_material_id === id);
          set((old) => ({ ...old, raw_material_id: id, material_qty: recipeEstimate(r, old.output_qty) }));
        }} />
        <WorkshopField label="Material to set aside" hint={selectedRecipe ? `Recipe: ${units(selectedRecipe.material_qty, material?.unit)} make about ${selectedRecipe.output_qty} pieces. Adjust for this job if needed.` : 'No recipe yet. Enter the material needed for this job.'} type="number" min="1" max={material ? availableMaterial(material, batches) : 0} step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        <WorkshopField label="Who will make it?" hint="Assign the worker responsible for this batch." required options={staff.filter((s) => s.status === 'Active' && ['Admin', 'Manager', 'Production Staff'].includes(s.role)).map((s) => ({ value: s.id, label: s.name }))} value={v.assigned_staff_id} onChange={(e) => change('assigned_staff_id', e.target.value)} />
        <WorkshopField label="Customer order, if any" hint="Leave blank when replenishing shelf stock." options={orders.filter((o) => o.status === 'Pending').map((o) => ({ value: o.id, label: `Order #${o.id}` }))} value={v.order_id} onChange={(e) => change('order_id', e.target.value)} />
        <WorkshopField label="Instructions for this batch" hint="Optional: custom size, event backdrop details or adjustments to the recipe." multiline value={v.notes} onChange={(e) => change('notes', e.target.value)} />
        <ReviewBox>
          {material && Number(v.material_qty) > 0
            ? <>Set aside {units(Number(v.material_qty), material.unit)} of {material.name}. Nothing is deducted from stock until the batch is finished and checked.</>
            : 'The material chosen here is set aside for this batch. Nothing is deducted from stock until the batch is finished and checked.'}
          <p>Approved by {profile.name}. The make list will show this batch as ready to start.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
