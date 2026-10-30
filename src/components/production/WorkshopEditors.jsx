import WorkshopForm, { ReviewBox, WorkshopField } from './WorkshopForm';
import { Row } from '../shared/forms';
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

  return <WorkshopForm title={editing ? `Edit ${material.name}` : 'Add raw material'}
    description="Something the workshop uses up to make products. Counted apart from the products you sell."
    submitLabel={editing ? 'Save changes' : 'Add material'} initial={initial} validate={validate} onSave={submit} onClose={onClose}>
    {(v, change) => <>
      <WorkshopField name="name" label="Name" hint="The name staff use on the floor. Any punctuation is fine, such as 1/2&quot; or (high density)." required maxLength={200} value={v.name} onChange={(e) => change('name', e.target.value)} />
      <Row>
      <WorkshopField name="sku" label={editing ? 'Code' : <>Code <span className="font-normal text-muted-fg">(optional)</span></>}
        hint={editing
          ? 'Letters, numbers and single hyphens, such as SS-100-4X8. Use the same code as a product to be able to move stock between them.'
          : 'Leave it blank and a code such as RM-SHT-001 is made for you.'}
        required={editing} maxLength={40} autoCapitalize="characters" value={v.sku}
        onChange={(e) => change('sku', e.target.value.toUpperCase())} />
      <WorkshopField name="material_type" label="Kind" hint="What the workshop uses it as." required options={MATERIAL_KINDS} value={v.material_type} onChange={(e) => change('material_type', e.target.value)} />
      </Row>
      <WorkshopField name="unit" label="Counted in" hint="Every delivery, batch and stock count for this material uses this unit." required
        options={[...unitsOffered.map((u) => ({ value: u, label: u })), { value: OTHER_UNIT, label: 'Another unit…' }]}
        value={v.unit} onChange={(e) => change('unit', e.target.value)} />
      {v.unit === OTHER_UNIT && (
        <WorkshopField name="unit_other" label="Name of the new unit" hint="One word or a short phrase in letters, such as tube or spool. It is saved in lower case and offered for other materials too." required maxLength={24} value={v.unit_other} onChange={(e) => change('unit_other', e.target.value)} />
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <p className="m-0 text-13 text-muted-fg sm:col-span-2">Size and weight, all optional. Leave blank what does not apply.</p>
        {SIZE_FIELDS.map(({ key, label }) => (
          <WorkshopField key={key} name={key} label={label} type="number" inputMode="decimal" min="0" step="any" value={v[key]} onChange={(e) => change(key, e.target.value)} />
        ))}
      </div>
      <WorkshopField name="low_stock_threshold" label="Order more below" hint="At or below this many free to use, the material shows as running low." suffix={v.unit === OTHER_UNIT ? undefined : pluralUnit(v.unit, 2)} required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.low_stock_threshold} onChange={(e) => change('low_stock_threshold', e.target.value)} />
      <ReviewBox>{editing
        ? 'Changing these details never changes the count on hand. Stock only changes when a supplier order is received, a production batch is finished, damage is written off or a manager corrects the count.'
        : 'A new material starts at 0 on hand. After this, stock only comes in when a supplier order is received.'}</ReviewBox>
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
/** How a supplier order is paid. A card payment is made on ordering; COD on arrival. */
const SUPPLIER_PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on delivery' },
  { value: 'card', label: 'Credit card' },
];

export function SupplierOrderDialog({ order, preset, materials, suppliers, profile, onSave, onClose }) {
  const today = localDateIso();
  const initial = order
    ? { id: order.id, quantity_ordered: String(order.quantity_ordered ?? ''), unit_price: String(order.unit_price ?? ''),
        expected_delivery_date: order.expected_delivery_date || '', carrier_notes: order.carrier_notes || '',
        payment_method: order.payment_method || 'cod' }
    : { supplier_id: '', raw_material_id: '', quantity_ordered: '', unit_price: '', expected_delivery_date: '', carrier_notes: '', payment_method: 'cod', ...preset };
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

  // Only a total somebody can actually check: "—" until both the quantity
  // and the price are typed, never "₱0.00" as if it were the agreed price.
  const total = (v) => (Number(v.quantity_ordered) > 0 && v.unit_price !== '' && Number(v.unit_price) >= 0
    ? formatPeso(Number(v.quantity_ordered) * Number(v.unit_price)) : '—');
  return <WorkshopForm size="lg" title={order ? `Edit supplier order #${order.id}` : 'New supplier order'}
    description={order
      ? `${orderedMaterial?.name ?? 'Material'} from ${orderedFrom?.name ?? 'the supplier'}. Correct it until the order leaves the supplier; for another supplier or material, cancel it and place a new one.`
      : 'Nothing is added to stock until the delivery is received and counted.'}
    footerNote={(v) => <>Order total <strong className="ml-1 font-semibold text-foreground tabular-nums">{total(v)}</strong></>}
    submitLabel={order ? 'Save changes' : 'Place order'} initial={initial} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const material = order ? orderedMaterial : materials.find((m) => String(m.id) === String(v.raw_material_id));
      return <>
        {!order && <>
          {suppliers.length === 0 && (
            <ReviewBox warning>There are no suppliers yet. Add the supplier under Suppliers first, then come back to order from them.</ReviewBox>
          )}
          <Row>
          <WorkshopField name="raw_material_id" label="Material" required
            options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.sku})` }))}
            value={v.raw_material_id} onChange={(e) => change('raw_material_id', e.target.value)} />
          <WorkshopField name="supplier_id" label="Supplier" required options={suppliers.filter((s) => s.status !== 'Archived').map((s) => ({ value: s.id, label: s.name }))} value={v.supplier_id} onChange={(e) => change('supplier_id', e.target.value)} />
          </Row>
        </>}
        {material ? (
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-13 text-fg-2">
            {units(material.stock, material.unit)} on hand. Order more below {units(material.low_stock_threshold ?? 0, material.unit)}.
          </p>
        ) : null}
        <Row className="sm:grid-cols-3">
          <WorkshopField name="quantity_ordered" label="How much" suffix={material ? pluralUnit(material.unit, 2) : undefined}
            required type="number" inputMode="numeric" min="1" max="2000000000" step="1" value={v.quantity_ordered} onChange={(e) => change('quantity_ordered', e.target.value)} />
          <WorkshopField name="unit_price" label="Agreed price" suffix={material ? `₱ / ${material.unit}` : '₱ each'} required type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={v.unit_price} onChange={(e) => change('unit_price', e.target.value)} />
        <WorkshopField name="expected_delivery_date" label="Expected"
          type="date" min={order?.expected_delivery_date && order.expected_delivery_date < today ? undefined : today}
          value={v.expected_delivery_date || ''} onChange={(e) => change('expected_delivery_date', e.target.value)} />
        </Row>
        <WorkshopField name="payment_method" label="Paid by" required placeholder="Choose how"
          hint={v.payment_method === 'card' ? 'Paid by card when the order is placed.' : 'Paid in cash when the delivery is received.'}
          options={SUPPLIER_PAYMENT_METHODS} value={v.payment_method} onChange={(e) => change('payment_method', e.target.value)} />
        <WorkshopField name="carrier_notes" label={<>Courier and delivery notes <span className="font-normal text-muted-fg">(optional)</span></>} hint="The driver's phone number and any delivery instructions. The expected date can wait until the supplier confirms." multiline maxLength={1000} value={v.carrier_notes || ''} onChange={(e) => change('carrier_notes', e.target.value)} />
        <ReviewBox>{order ? 'Changed' : 'Placed'} by {profile.name}.</ReviewBox>
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
  return <WorkshopForm title="Material recipe" description="The usual amount of material for a finished product. A batch can still use a different amount."
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

/**
 * A one-step confirmation, optionally asking why.
 *
 * The reason defaults to the supplier-claim wording it was written for; a
 * correction (cancelling, deleting, re-opening) passes its own question,
 * because the activity log is the only place that reason survives. `danger`
 * puts the verb on a red button, for steps that remove or reverse something.
 */
export function WorkshopConfirmation({
  title, description, action, initial, needsReason = false, danger = false,
  reasonLabel = 'How was the supplier issue settled?',
  reasonHint = 'The replacement, refund or other outcome agreed. A replacement delivery is ordered and received as a new order.',
  reasonMissing = 'Write how the issue was settled.', reasonMax = 1000, cancelLabel,
  profile, onSave, onClose,
}) {
  const validate = needsReason ? (v) => ({ reason: String(v.reason ?? '').trim() ? null : reasonMissing }) : undefined;
  return <WorkshopForm title={title} description={description} submitLabel={action} submitVariant={danger ? 'danger' : 'default'} cancelLabel={cancelLabel} initial={{ ...initial, reason: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => <>
      {needsReason && <WorkshopField name="reason" label={reasonLabel} hint={reasonHint} required multiline maxLength={reasonMax} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
      <ReviewBox>Confirmed by {profile.name}. This is saved in the activity log.</ReviewBox>
    </>}
  </WorkshopForm>;
}
