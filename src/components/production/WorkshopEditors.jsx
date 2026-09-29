import WorkshopForm, { ReviewBox, WorkshopField } from './WorkshopForm';
import { formatPeso } from '../../utils/profileFormat';
import { MATERIAL_KIND } from '../../utils/copy';
import { pluralUnit, units } from '../../utils/production';
import { localDateIso, promisedDateProblem } from '../../utils/dates';
import {
  codeProblem, countProblem, measureProblem, moneyProblem, nameProblem, tidyLabel, unitProblem,
} from '../../utils/validation';

const MATERIAL_KINDS = Object.entries(MATERIAL_KIND).map(([value, label]) => ({ value, label }));

/**
 * The measurements a material can carry, with the limits the database checks.
 * `step="any"` so a whole number is typed as a whole number: nobody has to add
 * ".00" to get "12" accepted.
 */
const SIZE_FIELDS = [
  { key: 'density', label: 'Density (kg/m³)', check: { label: 'The density', max: 25000, unit: 'kg/m³' } },
  { key: 'weight_kg', label: 'Weight of one unit (kg)', check: { label: 'The weight', max: 10000, unit: 'kg' } },
  { key: 'thickness_in', label: 'Thickness (inches)', check: { label: 'The thickness', max: 240, unit: 'inches' } },
  { key: 'length_ft', label: 'Length (feet)', check: { label: 'The length', max: 200, unit: 'feet' } },
  { key: 'width_ft', label: 'Width (feet)', check: { label: 'The width', max: 200, unit: 'feet' } },
];

/**
 * The units offered for counting a material. A managed list rather than a
 * free-text box, so one material is not counted in "sheet" and the next in
 * "Sheets" or "sht". Units already in use are added to it; a new one is typed
 * once through "Another unit", checked, and stored in the same lower-case form.
 */
const STANDARD_UNITS = ['sheet', 'block', 'piece', 'roll', 'bottle', 'can', 'bag', 'box', 'kg', 'liter', 'meter'];
const OTHER_UNIT = '__other';

function unitChoices(materials = [], current = '') {
  const seen = new Set(STANDARD_UNITS);
  for (const m of materials) if (m.unit) seen.add(String(m.unit).trim().toLowerCase());
  if (current) seen.add(String(current).trim().toLowerCase());
  return [...seen].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function MaterialDialog({ material, materials = [], onSave, onClose }) {
  const editing = Boolean(material);
  const unitsOffered = unitChoices(materials, material?.unit);
  const others = materials.filter((m) => m.id !== material?.id);

  // A measurement that was never filled in comes back null, and a null in an
  // input is React's uncontrolled/controlled warning.
  const initial = material
    ? { ...material, unit_other: '', density: material.density ?? '', weight_kg: material.weight_kg ?? '',
        thickness_in: material.thickness_in ?? '', length_ft: material.length_ft ?? '', width_ft: material.width_ft ?? '',
        low_stock_threshold: String(material.low_stock_threshold ?? '') }
    : { sku: '', name: '', material_type: 'sheet', unit: 'sheet', unit_other: '', density: '', weight_kg: '',
        thickness_in: '', length_ft: '', width_ft: '', low_stock_threshold: '20' };

  function validate(v) {
    const code = String(v.sku ?? '').trim().toUpperCase();
    // A code saved before the format existed is left alone until it is changed.
    const unchangedCode = editing && code === String(material.sku ?? '').toUpperCase();
    const unit = v.unit === OTHER_UNIT ? v.unit_other : v.unit;
    const unchangedUnit = editing && tidyLabel(unit).toLowerCase() === String(material.unit ?? '').toLowerCase();
    return {
      sku: editing && code === '' ? 'The code is needed. Leave it as it was, or type a new one.'
        : unchangedCode ? null
          : codeProblem(code) ?? (others.some((m) => String(m.sku).toUpperCase() === code) ? `Another material already uses the code ${code}.` : null),
      name: nameProblem(v.name, { label: 'The material name' }),
      material_type: v.material_type ? null : 'Choose what kind of material it is.',
      unit: v.unit ? null : 'Choose the unit it is counted in.',
      unit_other: v.unit === OTHER_UNIT && !unchangedUnit ? unitProblem(v.unit_other) : null,
      ...Object.fromEntries(SIZE_FIELDS.map(({ key, check }) => [key, measureProblem(v[key], check)])),
      low_stock_threshold: countProblem(v.low_stock_threshold, { label: 'The warning level' }),
    };
  }

  const submit = (values, key) => {
    const { unit_other: typed, ...rest } = values;
    const payload = {
      ...rest,
      sku: String(rest.sku ?? '').trim().toUpperCase(),
      name: tidyLabel(rest.name),
      unit: tidyLabel(rest.unit === OTHER_UNIT ? typed : rest.unit).toLowerCase(),
    };
    // The revision the form was opened on travels with the save, so a material
    // somebody else changed in the meantime is refused rather than overwritten.
    return onSave(editing ? { ...payload, expectedRevision: material.revision ?? 0 } : payload, key);
  };

  return <WorkshopForm title={editing ? `Edit ${material.name}` : 'Add a raw material'}
    description="Raw materials are what the workshop builds with. They are counted separately from the products you sell."
    submitLabel={editing ? 'Save changes' : 'Add material'} initial={initial} validate={validate} onSave={submit} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField name="name" label="Material name" hint="The name staff use on the floor. Any punctuation is fine, such as 1/2&quot; or (high density)." required maxLength={200} value={v.name} onChange={(e) => change('name', e.target.value)} />
      <WorkshopField name="sku" label="Material code"
        hint={editing
          ? 'Letters, numbers and single hyphens, such as SS-100-4X8. Use the same code as a product to be able to move stock between them.'
          : 'Optional. Leave it blank and a code such as RM-SHT-001 is made for you. Letters, numbers and single hyphens only.'}
        required={editing} maxLength={40} autoCapitalize="characters" value={v.sku}
        onChange={(e) => change('sku', e.target.value.toUpperCase())} />
      <WorkshopField name="material_type" label="Kind of material" hint="What the workshop uses it as." required options={MATERIAL_KINDS} value={v.material_type} onChange={(e) => change('material_type', e.target.value)} />
      <WorkshopField name="unit" label="Unit it is counted in" hint="Every delivery, batch and stock count for this material uses this unit." required
        options={[...unitsOffered.map((u) => ({ value: u, label: u })), { value: OTHER_UNIT, label: 'Another unit…' }]}
        value={v.unit} onChange={(e) => change('unit', e.target.value)} />
      {v.unit === OTHER_UNIT && (
        <WorkshopField name="unit_other" label="Name of the new unit" hint="One word or a short phrase in letters, such as tube or spool. It is saved in lower case and offered for other materials too." required maxLength={24} value={v.unit_other} onChange={(e) => change('unit_other', e.target.value)} />
      )}
      {SIZE_FIELDS.map(({ key, label }) => (
        <WorkshopField key={key} name={key} label={label} hint="Optional. Leave blank if it does not apply. Whole numbers or decimals, above 0." type="number" inputMode="decimal" min="0" step="any" value={v[key]} onChange={(e) => change(key, e.target.value)} />
      ))}
      <WorkshopField name="low_stock_threshold" label="Warn when stock reaches" hint="At or below this many units free to use, the material is shown as running low." required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.low_stock_threshold} onChange={(e) => change('low_stock_threshold', e.target.value)} />
      <ReviewBox>{editing
        ? 'Changing these details never changes the count on hand. Stock only changes when a supplier order is received, a production batch is finished, damage is written off or a manager corrects the count.'
        : 'A new material starts at 0 on hand. Order it under Purchasing and receive the delivery to add stock.'}</ReviewBox>
    </>}
  </WorkshopForm>;
}

/**
 * Placing a supplier order, or correcting one that has not left the supplier.
 *
 * A correction can change the quantity, the agreed price, the promised date and
 * the courier notes. The supplier and the material are fixed once the order is
 * placed: a different supplier or material is a different order, so that one
 * is cancelled and a new one placed.
 */
export function SupplierOrderDialog({ order, preset, materials, suppliers, profile, onSave, onClose }) {
  const today = localDateIso();
  const initial = order
    ? { id: order.id, quantity_ordered: String(order.quantity_ordered ?? ''), unit_price: String(order.unit_price ?? ''),
        expected_delivery_date: order.expected_delivery_date || '', carrier_notes: order.carrier_notes || '' }
    : { supplier_id: '', raw_material_id: '', quantity_ordered: '', unit_price: '', expected_delivery_date: '', carrier_notes: '', ...preset };
  const orderedMaterial = order ? materials.find((m) => m.id === order.raw_material_id) : null;
  const orderedFrom = order ? suppliers.find((s) => s.id === order.supplier_id) : null;

  function validate(v) {
    return {
      ...(order ? {} : {
        supplier_id: v.supplier_id ? null : 'Choose the supplier you are ordering from.',
        raw_material_id: v.raw_material_id ? null : 'Choose the material to order.',
      }),
      quantity_ordered: countProblem(v.quantity_ordered, { min: 1, label: 'The quantity' }),
      unit_price: moneyProblem(v.unit_price, { label: 'The price per unit' }),
      expected_delivery_date: promisedDateProblem(v.expected_delivery_date, order?.expected_delivery_date ?? null),
      carrier_notes: String(v.carrier_notes ?? '').length > 1000 ? 'Keep the notes to 1,000 characters.' : null,
    };
  }

  return <WorkshopForm title={order ? `Edit supplier order #${order.id}` : 'Order raw materials'}
    description={order
      ? `${orderedMaterial?.name ?? 'Material'} from ${orderedFrom?.name ?? 'the supplier'}. Correct the quantity, price, date or notes until the order leaves the supplier. To change the supplier or material, cancel this order and place a new one.`
      : 'Record what you ordered from a supplier and the price you agreed. Stock is added only when the delivery is received.'}
    submitLabel={order ? 'Save changes' : 'Place order'} initial={initial} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const material = order ? orderedMaterial : materials.find((m) => String(m.id) === String(v.raw_material_id));
      return <>
        {!order && <>
          {suppliers.length === 0 && (
            <ReviewBox warning>There are no suppliers yet. Add the supplier under Suppliers first, then come back to order from them.</ReviewBox>
          )}
          <WorkshopField name="supplier_id" label="Supplier" hint="Who you are ordering from." required options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={v.supplier_id} onChange={(e) => change('supplier_id', e.target.value)} />
          <WorkshopField name="raw_material_id" label="Material to order" hint="The material's code fixes the size and density being ordered." required
            options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.sku}) · ${units(m.stock, m.unit)} on hand` }))}
            value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)} />
        </>}
          <WorkshopField name="quantity_ordered" label={material ? `How many ${pluralUnit(material.unit, 2)}` : 'Quantity ordered'}
            hint={material ? `Counted in ${pluralUnit(material.unit, 2)}, the unit this material is counted in. A whole number.` : 'A whole number, in the unit the material is counted in.'}
            required type="number" inputMode="numeric" min="1" max="2000000000" step="1" value={v.quantity_ordered} onChange={(e) => change('quantity_ordered', e.target.value)} />
          <WorkshopField name="unit_price" label="Agreed price per unit (₱)" hint="Whole pesos or pesos and centavos, such as 120 or 120.50." required type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={v.unit_price} onChange={(e) => change('unit_price', e.target.value)} />
        <WorkshopField name="expected_delivery_date" label="Promised delivery date"
          hint="Optional until the supplier confirms. Today or later. Setting a date marks the order as having a delivery date."
          type="date" min={order?.expected_delivery_date && order.expected_delivery_date < today ? undefined : today}
          value={v.expected_delivery_date || ''} onChange={(e) => change('expected_delivery_date', e.target.value)} />
        <WorkshopField name="carrier_notes" label="Courier, vehicle and driver contact" hint="Optional. The driver's phone number and any delivery instructions." multiline maxLength={1000} value={v.carrier_notes || ''} onChange={(e) => change('carrier_notes', e.target.value)} />
        {/* Only a total somebody can actually check. Multiplying two empty
            fields printed "₱0.00" as if it were the agreed price. */}
        <ReviewBox>
          {Number(v.quantity_ordered) > 0 && v.unit_price !== '' && Number(v.unit_price) >= 0
            ? <>Agreed total: <strong className="font-extrabold text-ink">{formatPeso(Number(v.quantity_ordered) * Number(v.unit_price))}</strong>.</>
            : 'The agreed total is worked out from the quantity and the price per unit.'}
          <p>{order ? 'Changed' : 'Placed'} by {profile.name}. Nothing is added to stock until the delivery is received and counted.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}

export function RecipeDialog({ products, materials, onSave, onClose }) {
  const validate = (v) => ({
    product_id: v.product_id ? null : 'Choose the finished product.',
    raw_material_id: v.raw_material_id ? null : 'Choose the raw material.',
    material_qty: countProblem(v.material_qty, { min: 1, label: 'The material needed' }),
    output_qty: countProblem(v.output_qty, { min: 1, label: 'The pieces produced' }),
  });
  return <WorkshopForm title="Save a material recipe" description="The usual amount of material for a finished product. A batch can still use a different amount."
    submitLabel="Save recipe" initial={{ product_id: '', raw_material_id: '', material_qty: '', output_qty: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField name="product_id" label="Finished product" hint="Saving this product and material again replaces its previous recipe." required options={products.map((p) => ({ value: p.id, label: p.name }))} value={v.product_id} onChange={(e) => change('product_id', e.target.value)} />
      <WorkshopField name="raw_material_id" label="Raw material" hint="The size and density normally used." required options={materials.map((m) => ({ value: m.id, label: m.name }))} value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)} />
      <WorkshopField name="material_qty" label="Material units needed" hint="A whole number, for example 45 sheets." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
      <WorkshopField name="output_qty" label="Expected pieces produced" hint="A whole number, for example about 100 pieces before damaged pieces are counted." type="number" inputMode="numeric" min="1" max="2000000000" step="1" required value={v.output_qty} onChange={(e) => change('output_qty', e.target.value)} />
    </>}
  </WorkshopForm>;
}

export function TransferDialog({ material, inventory, profile, onSave, onClose }) {
  const validate = (v) => ({
    quantity: countProblem(v.quantity, { min: 1, max: inventory.stock, label: 'The number to move' }),
  });
  return <WorkshopForm title="Move selling stock to raw materials" description="Move a counted supply from Products & stock into workshop stock."
    submitLabel="Move stock" initial={{ raw_material_id: material.id, inventory_id: inventory.id, quantity: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField name="quantity" label="Selling units to move" hint={`${inventory.name}: ${units(inventory.stock, inventory.unit)} on the shelf. Each one is ${units(inventory.packSize || 1, material.unit)}.`} required type="number" inputMode="numeric" min="1" max={inventory.stock} step="1" value={v.quantity} onChange={(e) => change('quantity', e.target.value)} />
      <ReviewBox warning>
        Takes {units(Number(v.quantity) || 0, inventory.unit)} off Products &amp; stock and adds {units(Number(v.quantity) * (inventory.packSize || 1) || 0, material.unit)} to raw materials. A waiting customer order for this product stops the move.
        <p>Approved by {profile.name}.</p>
      </ReviewBox>
    </>}
  </WorkshopForm>;
}

export function WorkshopConfirmation({ title, description, action, initial, needsReason = false, profile, onSave, onClose }) {
  const validate = needsReason ? (v) => ({ reason: String(v.reason ?? '').trim() ? null : 'Write how the issue was settled.' }) : undefined;
  return <WorkshopForm title={title} description={description} submitLabel={action} initial={{ ...initial, reason: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {needsReason && <WorkshopField name="reason" label="How was the supplier issue settled?" hint="The replacement, refund or other outcome agreed. A replacement delivery is ordered and received as a new order." required multiline maxLength={1000} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
      <ReviewBox>Confirmed by {profile.name}. This is saved in the activity log.</ReviewBox>
    </>}
  </WorkshopForm>;
}
