import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { pluralUnit, receiptCounts, units } from '../../utils/production';
import { TRANSIT_REASONS } from '../../utils/copy';

export default function ReceiveSupplierDeliveryDialog({ order, material, profile, onSave, onClose }) {
  return <WorkshopForm title="Receive delivery" description={`${material.name} — ${units(order.quantity_ordered, material.unit)} expected.`}
    submitLabel="Accept usable stock" initial={{ id: order.id, arrived: '', damaged: '0', reason: '', reference: '' }} onSave={onSave} onClose={onClose}
    validate={(v) => !receiptCounts(order.quantity_ordered, v.arrived, v.damaged) ? 'Damaged must be a whole count no larger than arrived.' : Number(v.damaged) > 0 && !v.reason ? 'Choose why the material was damaged.' : null}>
    {(v, change) => {
      const counts = receiptCounts(order.quantity_ordered, v.arrived, v.damaged);
      const counted = v.arrived !== '' && counts !== null;
      return <>
        <WorkshopField label="Quantity physically unloaded" hint="Count everything unloaded, including damaged sheets. Enter zero if nothing arrived." type="number" min="0" max="2000000000" step="1" required value={v.arrived} onChange={(e) => change('arrived', e.target.value)} />
        <WorkshopField label="Damaged on arrival" hint="These cannot be used and will not go into stock." type="number" min="0" max={v.arrived || 0} step="1" required value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        {Number(v.damaged) > 0 && <WorkshopField label="What happened on the way?" hint="Choose the main reason for the supplier claim." required options={TRANSIT_REASONS.map((r) => ({ value: r, label: r }))} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        <WorkshopField label="Their delivery receipt or invoice number" hint="Optional. Printed on the supplier's paperwork, so the delivery can be found again." maxLength={80} value={v.reference} onChange={(e) => change('reference', e.target.value)} />
        {counted ? <>
          <ReviewBox arrives>
            <strong className="font-extrabold text-ink">{v.arrived} arrived − {v.damaged} damaged = {counts.usable} usable {pluralUnit(material.unit, counts.usable)}.</strong>
            <p>Raw material stock: {material.stock} → {material.stock + counts.usable}. This closes this delivery; order a replacement separately if needed.</p>
            <p>Accepted by {profile.name}.</p>
          </ReviewBox>
          {counts.claim && <ReviewBox warning arrives>Short by {counts.short} / {v.damaged} damaged in transit{counts.extra ? ` / ${counts.extra} extra received` : ''}. Supplier claim flagged for manager review.</ReviewBox>}
        </> : <ReviewBox>Enter the count actually unloaded to see the usable stock this adds. Nothing is added until you accept it below.</ReviewBox>}
      </>;
    }}
  </WorkshopForm>;
}
