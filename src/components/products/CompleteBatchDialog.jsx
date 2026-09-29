import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { availableMaterial, completionCounts, freeMaterial, units } from '../../utils/production';
import { DEFECT_REASONS } from '../../utils/copy';
import { countProblem } from '../../utils/validation';

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

  return <WorkshopForm title="Finish batch & quality check" description={`${batch.batch_code} · ${product.name}`}
    submitLabel="Finish batch and update stock" initial={{ id: batch.id, produced: '', damaged: '0', reason: '', material_qty: batch.raw_material_used_qty }} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = completionCounts(v.produced, v.damaged, size);
      const counted = v.produced !== '' && counts !== null;
      return <>
        <WorkshopField name="produced" label="Total pieces produced" hint="Good and damaged pieces together. Enter 0 for a failed run that still used material." required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.produced} onChange={(e) => change('produced', e.target.value)} />
        <WorkshopField name="damaged" label="Damaged pieces" hint="Pieces that cannot be sold. They are logged, not added to stock." required type="number" inputMode="numeric" min="0" step="1" value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        {(Number(v.damaged) > 0 || v.produced === '0') && <WorkshopField name="reason" label="Why were they damaged?" hint="The main cause, so a manager can follow it up." required options={DEFECT_REASONS} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        {counted && <ReviewBox arrives><strong className="font-extrabold text-ink">Processed: {v.produced} − damaged: {v.damaged} = {counts.good} pieces to shelf.</strong><p>{counts.yield.toFixed(1)}% good pieces. {size > 1 ? `${counts.shelfUnits} selling packs of ${size} pieces.` : ''}</p></ReviewBox>}
        <WorkshopField name="material_qty" label="Raw material actually used" hint={`${material.name}: ${units(freeMaterial(material, batches, batch.id), material.unit)} available for this batch. Change the planned amount if more or less was used.`} required type="number" inputMode="numeric" min="1" step="1" value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        {/* Held back until there is a count to state. It used to read "Add —
            good pieces to Styro Ball 4 inch" before anybody had typed, which
            looks like the screen is broken rather than like it is waiting. */}
        <ReviewBox warning={counted}>
          {counted
            ? <>Stock out: deduct {units(Number(v.material_qty) || 0, material.unit)} of {material.name}. Stock in: add {counts.good} good pieces to {product.name}. {v.damaged} damaged pieces go to the damage log. The oldest material lots are recorded against this batch.</>
            : <>Enter the pieces produced to see exactly what will be added to {product.name} and deducted from {material.name}.</>}
          <p>Checked and approved by {profile.name}. This finishes the batch and cannot be submitted a second time.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
