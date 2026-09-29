import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { pluralUnit, receiptCounts, units } from '../../utils/production';
import { TRANSIT_REASONS } from '../../utils/copy';
import { countProblem } from '../../utils/validation';

export default function ReceiveSupplierDeliveryDialog({ order, material, profile, onSave, onClose }) {
  function validate(v) {
    const arrived = countProblem(v.arrived, { label: 'The quantity unloaded' });
    const damaged = countProblem(v.damaged, { label: 'The damaged quantity' });
    return {
      arrived,
      damaged: damaged ?? (!arrived && Number(v.damaged) > Number(v.arrived) ? 'Damaged cannot be more than what was unloaded.' : null),
      reason: Number(v.damaged) > 0 && !v.reason ? 'Choose what happened to the damaged units.' : null,
      reference: String(v.reference ?? '').length > 80 ? 'Keep the reference to 80 characters.' : null,
    };
  }
  return <WorkshopForm title="Receive delivery" description={`${material.name}: ${units(order.quantity_ordered, material.unit)} ordered on order #${order.id}.`}
    submitLabel="Accept usable stock" initial={{ id: order.id, arrived: '', damaged: '0', reason: '', reference: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = receiptCounts(order.quantity_ordered, v.arrived, v.damaged);
      const counted = v.arrived !== '' && counts !== null;
      return <>
        <WorkshopField name="arrived" label="Quantity physically unloaded" hint="Count everything unloaded, damaged units included. Enter 0 if nothing arrived." type="number" inputMode="numeric" min="0" max="2000000000" step="1" required value={v.arrived} onChange={(e) => change('arrived', e.target.value)} />
        <WorkshopField name="damaged" label="Damaged on arrival" hint="These cannot be used and are not added to stock." type="number" inputMode="numeric" min="0" step="1" required value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        {Number(v.damaged) > 0 && <WorkshopField name="reason" label="What happened on the way?" hint="The main reason, for the supplier claim." required options={TRANSIT_REASONS.map((r) => ({ value: r, label: r }))} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        <WorkshopField name="reference" label="Their delivery receipt or invoice number" hint="Optional. Printed on the supplier's paperwork, so the delivery can be found again." maxLength={80} value={v.reference} onChange={(e) => change('reference', e.target.value)} />
        {counted ? <>
          <ReviewBox arrives>
            <strong className="font-extrabold text-ink">{v.arrived} arrived − {v.damaged} damaged = {counts.usable} usable {pluralUnit(material.unit, counts.usable)}.</strong>
            <p>Stock in: raw material stock goes from {material.stock} to {material.stock + counts.usable}. This closes the order as Received; order any replacement separately.</p>
            <p>Accepted by {profile.name}.</p>
          </ReviewBox>
          {counts.claim && <ReviewBox warning arrives>Short by {counts.short} / {v.damaged} damaged in transit{counts.extra ? ` / ${counts.extra} extra received` : ''}. Supplier claim flagged for manager review.</ReviewBox>}
        </> : <ReviewBox>Enter the count actually unloaded to see the usable stock this adds. Nothing is added until you accept it below.</ReviewBox>}
      </>;
    }}
  </WorkshopForm>;
}
