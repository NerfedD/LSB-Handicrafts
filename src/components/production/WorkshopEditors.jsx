import WorkshopForm, { ReviewBox, WorkshopField } from './WorkshopForm';
import { formatPeso } from '../../utils/profileFormat';
import { MATERIAL_KIND } from '../../utils/copy';
import { units } from '../../utils/production';

const MATERIAL_KINDS = Object.entries(MATERIAL_KIND).map(([value, label]) => ({ value, label }));
const SIZE_FIELDS = [
  ['density', 'Density (kg/m³)'],
  ['thickness_in', 'Thickness (inches)'],
  ['length_ft', 'Length (feet)'],
  ['width_ft', 'Width (feet)'],
];

export function MaterialDialog({ material, onSave, onClose }) {
  const editing = Boolean(material);
  return <WorkshopForm title={editing ? 'Change raw material' : 'Add raw material'} description="Keep workshop supplies separate from products for sale."
    submitLabel="Save material" initial={material || { sku: '', name: '', material_type: 'sheet', unit: 'sheet', density: '', thickness_in: '', length_ft: '', width_ft: '', low_stock_threshold: '20' }} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {!editing && <WorkshopField label="Material code" hint="Use the supplier or workshop code, such as SS-100-4X8." required maxLength={80} value={v.sku} onChange={(e) => change('sku', e.target.value)} />}
      <WorkshopField label="Material name" hint="Write the name staff use on the floor." required maxLength={200} value={v.name} onChange={(e) => change('name', e.target.value)} />
      {!editing && <>
        <WorkshopField label="Kind of material" hint="Choose what the workshop uses it as." required options={MATERIAL_KINDS} value={v.material_type} onChange={(e) => change('material_type', e.target.value)} />
        <WorkshopField label="Unit we count" hint="For example: sheet, block, bottle or roll. All receipts and batches use this unit." required value={v.unit} onChange={(e) => change('unit', e.target.value)} />
        {SIZE_FIELDS.map(([key, label]) => <WorkshopField key={key} label={label} hint="Optional. Leave blank if this does not apply." type="number" min="0.01" step="any" value={v[key]} onChange={(e) => change(key, e.target.value)} />)}
      </>}
      <WorkshopField label="Warn when stock reaches" hint="A material at or below this count is shown as running low." required type="number" min="0" max="2000000000" step="1" value={v.low_stock_threshold} onChange={(e) => change('low_stock_threshold', e.target.value)} />
      {/* The note only holds while the record is being created. Telling somebody
          editing a material that "new materials start at zero" answered a
          question they had not asked, about a material that already has stock. */}
      <ReviewBox>{editing
        ? 'Changing these details does not move stock. The count on hand only changes when a delivery is received, stock is moved here, or a batch is finished.'
        : 'New materials start at zero. Receive a supplier delivery or move matching sheet stock to add a counted supply.'}</ReviewBox>
    </>}
  </WorkshopForm>;
}

export function SupplierOrderDialog({ order, materials, suppliers, profile, onSave, onClose }) {
  return <WorkshopForm title={order ? 'Set delivery details' : 'Order raw materials'} description="Record the supplier promise and agreed price."
    submitLabel="Save supplier order" initial={order || { supplier_id: '', raw_material_id: '', quantity_ordered: '', unit_price: '', expected_delivery_date: '', carrier_notes: '' }} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {!order && <>
        <WorkshopField label="Supplier" hint="Choose an existing supplier contact." required options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={v.supplier_id} onChange={(e) => change('supplier_id', e.target.value)} />
        <WorkshopField label="Material to order" hint="The material code fixes the size and density being ordered." required options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.sku})` }))} value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)} />
        <WorkshopField label="Quantity ordered" hint="Count the material units, such as individual sheets." required type="number" min="1" max="2000000000" step="1" value={v.quantity_ordered} onChange={(e) => change('quantity_ordered', e.target.value)} />
        <WorkshopField label="Agreed price per unit (₱)" hint="The total below is calculated from the quantity and unit price." required type="number" min="0" max="999999999999.99" step="0.01" value={v.unit_price} onChange={(e) => change('unit_price', e.target.value)} />
      </>}
      <WorkshopField label="Promised delivery date" hint="Optional until the supplier confirms. Setting a date marks the delivery as scheduled." type="date" value={v.expected_delivery_date || ''} onChange={(e) => change('expected_delivery_date', e.target.value)} />
      <WorkshopField label="Courier, vehicle and driver contact" hint="Include the driver phone number and any delivery instructions." multiline value={v.carrier_notes || ''} onChange={(e) => change('carrier_notes', e.target.value)} />
      {/* Only a total somebody can actually check. Multiplying two empty
          fields printed "₱0.00" as if it were the agreed price. */}
      <ReviewBox>
        {Number(v.quantity_ordered) > 0 && Number(v.unit_price) > 0
          ? <>Agreed total: <strong className="font-extrabold text-ink">{formatPeso(Number(v.quantity_ordered) * Number(v.unit_price))}</strong>.</>
          : 'The agreed total is worked out from the quantity and the price per unit.'}
        <p>Approved by {profile.name}. No stock is added until staff receive and count the delivery.</p>
      </ReviewBox>
    </>}
  </WorkshopForm>;
}

export function RecipeDialog({ products, materials, onSave, onClose }) {
  return <WorkshopForm title="Save a material recipe" description="Set the usual amount of material for a finished product. A batch can use a different amount."
    submitLabel="Save recipe" initial={{ product_id: '', raw_material_id: '', material_qty: '', output_qty: '' }} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField label="Finished product" hint="Saving this product and material again replaces its previous recipe." required options={products.map((p) => ({ value: p.id, label: p.name }))} value={v.product_id} onChange={(e) => change('product_id', e.target.value)} />
      <WorkshopField label="Raw material" hint="Choose the size and density normally used." required options={materials.map((m) => ({ value: m.id, label: m.name }))} value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)} />
      <WorkshopField label="Material units needed" hint="For example, 45 sheets." type="number" min="1" max="2000000000" step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
      <WorkshopField label="Expected pieces produced" hint="For example, about 100 pieces before damaged pieces are counted." type="number" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => change('output_qty', e.target.value)} />
    </>}
  </WorkshopForm>;
}

export function TransferDialog({ material, inventory, profile, onSave, onClose }) {
  return <WorkshopForm title="Move sheets to raw materials" description="Move a counted supply from selling stock into workshop stock."
    submitLabel="Move stock to raw materials" initial={{ raw_material_id: material.id, inventory_id: inventory.id, quantity: '' }} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField label="Selling units to move" hint={`${inventory.name}: ${units(inventory.stock, inventory.unit)} on shelf. Each contains ${units(inventory.packSize || 1, material.unit)}.`} required type="number" min="1" max={inventory.stock} step="1" value={v.quantity} onChange={(e) => change('quantity', e.target.value)} />
      <ReviewBox warning>
        Deduct {units(Number(v.quantity) || 0, inventory.unit)} from products for sale. Add {units(Number(v.quantity) * (inventory.packSize || 1) || 0, material.unit)} to raw materials. Customer order history is kept. A waiting customer order for these sheets blocks the move.
        <p>Approved by {profile.name}.</p>
      </ReviewBox>
    </>}
  </WorkshopForm>;
}

export function WorkshopConfirmation({ title, description, action, initial, needsReason = false, profile, onSave, onClose }) {
  return <WorkshopForm title={title} description={description} submitLabel={action} initial={{ ...initial, reason: '' }} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {needsReason && <WorkshopField label="How was the supplier issue settled?" hint="Record the replacement, refund or agreed outcome. Replacements must be received as a new order." required multiline value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
      <ReviewBox>Approved by {profile.name}. This change will be saved in the activity log.</ReviewBox>
    </>}
  </WorkshopForm>;
}
