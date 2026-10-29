import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { Badge } from '@/components/ui/badge';
import { Row } from '../shared/forms';
import { pluralUnit, receiptCounts, units } from '../../utils/production';
import { TRANSIT_REASONS } from '../../utils/copy';
import { countProblem } from '../../utils/validation';

/**
 * Receive a supplier delivery, drawn to the "Receive delivery · Dialog" board:
 * what was unloaded and what was damaged side by side, what was wrong when
 * anything was, then Ordered / Usable / Result and the claim line.
 */
export default function ReceiveSupplierDeliveryDialog({ order, material, supplier, profile, onSave, onClose }) {
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
  const unit = pluralUnit(material.unit, 2);
  return <WorkshopForm title={`Receive order #${order.id}`}
    description={`${material.name}${supplier ? ` from ${supplier}` : ''} · ${units(order.quantity_ordered, material.unit)} ordered. Count what came off the truck.`}
    submitLabel="Add usable stock" cancelLabel="Not yet" initial={{ id: order.id, arrived: '', damaged: '0', reason: '', reference: '' }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = receiptCounts(order.quantity_ordered, v.arrived, v.damaged);
      const counted = v.arrived !== '' && counts !== null;
      const result = !counted ? null
        : counts.short ? `Short by ${units(counts.short, material.unit)}`
          : counts.extra ? `${units(counts.extra, material.unit)} extra`
            : counts.claim ? 'Damaged in transit' : 'Complete';
      return <>
        <Row>
          <WorkshopField name="arrived" label="Unloaded" hint="Everything unloaded, damaged included. 0 if nothing came." suffix={unit} type="number" inputMode="numeric" min="0" max="2000000000" step="1" required value={v.arrived} onChange={(e) => change('arrived', e.target.value)} />
          <WorkshopField name="damaged" label="Damaged or unusable" hint="Not added to stock." suffix={unit} type="number" inputMode="numeric" min="0" step="1" required value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        </Row>
        {Number(v.damaged) > 0 && <WorkshopField name="reason" label="What was wrong" hint="The main reason, for the supplier claim." required options={TRANSIT_REASONS.map((r) => ({ value: r, label: r }))} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        <WorkshopField name="reference" label={<>Their receipt or invoice number <span className="font-normal text-muted-fg">(optional)</span></>} hint="Printed on the supplier's paperwork, so the delivery can be found again." maxLength={80} value={v.reference} onChange={(e) => change('reference', e.target.value)} />
        <dl className="m-0 flex flex-col overflow-hidden rounded-md border border-border text-13">
          <div className="flex items-center justify-between border-b border-row-divider px-3 py-2"><dt className="text-muted-fg">Ordered</dt><dd className="m-0 tabular-nums">{units(order.quantity_ordered, material.unit)}</dd></div>
          <div className="flex items-center justify-between border-b border-row-divider px-3 py-2"><dt className="text-muted-fg">Usable, goes into stock</dt><dd className="m-0 font-medium tabular-nums">{counted ? units(counts.usable, material.unit) : '—'}</dd></div>
          <div className="flex items-center justify-between px-3 py-2"><dt className="text-muted-fg">Result</dt><dd className="m-0">{result ? <Badge variant={counts.claim ? 'warning' : 'success'}>{result}</Badge> : '—'}</dd></div>
        </dl>
        {counted
          ? <>
            <ReviewBox arrives>
              <strong>{v.arrived} arrived − {v.damaged} damaged = {counts.usable} usable {pluralUnit(material.unit, counts.usable)}.</strong>
              <p>Stock goes from {material.stock} to {material.stock + counts.usable}. The order closes as Received; order any replacement separately. Accepted by {profile.name}.</p>
            </ReviewBox>
            {counts.claim && <ReviewBox warning arrives>A claim opens for the difference so a manager can settle it{supplier ? ` with ${supplier}` : ''}.</ReviewBox>}
          </>
          : <ReviewBox>Nothing is added until you accept it below.</ReviewBox>}
      </>;
    }}
  </WorkshopForm>;
}
