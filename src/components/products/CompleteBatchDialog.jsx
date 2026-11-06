import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { availableMaterial, completionCounts, freeMaterial, units } from '../../utils/production';
import { DEFECT_REASONS } from '../../utils/copy';
import { countProblem } from '../../utils/validation';
import { Row } from '../shared/forms';

export default function CompleteBatchDialog({ batch, product, inventory, material, batches, profile, onSave, onClose }) {
  const size = inventory?.packSize || 1;
  const allowed = availableMaterial(material, batches, batch.id);

  function validate(v) {
    const produced = countProblem(v.produced, { label: 'The pieces produced' });
    const damaged = countProblem(v.damaged, { label: 'The damaged pieces' });
    const counts = completionCounts(v.produced, v.damaged, size);
    return {
      produced: produced
        ?? (counts && !counts.wholePacks ? `Good pieces must fill whole packs of ${size}; ${counts.good} good pieces do not.` : null),
      damaged: damaged ?? (!produced && Number(v.damaged) > Number(v.produced) ? 'Damaged pieces cannot be more than the pieces produced.' : null),
      reason: (Number(v.damaged) > 0 || String(v.produced).trim() === '0') && !v.reason ? 'Choose why the pieces were damaged.' : null,
      material_qty: countProblem(v.material_qty, { min: 1, label: 'The material used' })
        ?? (Number(v.material_qty) > allowed ? `Only ${units(Math.max(0, allowed), material.unit)} are available for this batch.` : null),
    };
  }

  return <WorkshopForm size="lg" title={`Count and finish ${batch.batch_code}`}
    description={`${product.name} · ${batch.target_output_qty} planned. Good pieces go onto the shelf; material is used up now.`}
    submitLabel="Finish batch" cancelLabel="Not yet"
    initial={{ id: batch.id, produced: '', damaged: '0', reason: '', material_qty: batch.raw_material_used_qty }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = completionCounts(v.produced, v.damaged, size);
      const counted = v.produced !== '' && counts !== null;
      return <>
        <Row>
          <WorkshopField name="produced" label="Pieces made" hint="Good and damaged together. 0 for a failed run that still used material." required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.produced} onChange={(e) => change('produced', e.target.value)} />
          <WorkshopField name="damaged" label="Damaged" hint="Logged, not added to stock." required type="number" inputMode="numeric" min="0" step="1" value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        </Row>
        {(Number(v.damaged) > 0 || v.produced === '0') && <WorkshopField name="reason" label="Why pieces were damaged" hint="The main cause, so a manager can follow it up." required options={DEFECT_REASONS} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        <WorkshopField name="material_qty" label={`Material actually used: ${material.name}`} hint={`${units(freeMaterial(material, batches, batch.id), material.unit)} available for this batch. Change the planned amount if more or less was used.`} suffix={material.unit} required type="number" inputMode="numeric" min="1" step="1" value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-13">
          <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Onto the shelf</dt><dd className="m-0 font-medium">{counted ? `+${counts.good} ${product.name}` : '—'}</dd></div>
          <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Damage rate</dt><dd className="m-0 font-medium">{counted && Number(v.produced) > 0 ? `${(100 - counts.yield).toFixed(1)}%` : '—'}</dd></div>
        </dl>
        <ReviewBox warning={counted}>
          {counted
            ? <>Deducts {units(Number(v.material_qty) || 0, material.unit)} of {material.name} and adds {counts.good} good pieces{size > 1 ? ` (${counts.shelfUnits} packs of ${size})` : ''} to {product.name}. {v.damaged} damaged go to the damage log.</>
            : <>Enter the pieces made to see what will be added to {product.name} and deducted from {material.name}.</>}
          <p>Checked by {profile.name}. A batch is finished once.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
