import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { availableMaterial, completionCounts, countValue, freeMaterial, units } from '../../utils/production';
import { DEFECT_REASONS } from '../../utils/copy';

export default function CompleteBatchDialog({ batch, product, inventory, material, batches, profile, onSave, onClose }) {
  const size = inventory?.packSize || 1;
  return <WorkshopForm title="Finish batch & quality check" description={`${batch.batch_code} — ${product.name}`}
    submitLabel="Finish batch and update stock" initial={{ id: batch.id, produced: '', damaged: '0', reason: '', material_qty: batch.raw_material_used_qty }} onSave={onSave} onClose={onClose}
    validate={(v) => {
      const counts = completionCounts(v.produced, v.damaged, size);
      return !counts ? 'Damaged must be a whole count no larger than produced.' : !counts.wholePacks ? `Good pieces must fill whole packs of ${size}.`
        : (Number(v.damaged) > 0 || Number(v.produced) === 0) && !v.reason ? 'Choose why the pieces were damaged.'
          : countValue(v.material_qty, 1) === null || Number(v.material_qty) > availableMaterial(material, batches, batch.id) ? 'Check the material consumed against what is available.' : null;
    }}>
    {(v, change) => {
      const counts = completionCounts(v.produced, v.damaged, size);
      const counted = v.produced !== '' && counts !== null;
      return <>
        <WorkshopField label="Total pieces produced" hint="Include good pieces and damaged pieces. Zero records a failed run that still used material." required type="number" min="0" max="2000000000" step="1" value={v.produced} onChange={(e) => change('produced', e.target.value)} />
        <WorkshopField label="Damaged pieces" hint="Count pieces that cannot be sold." required type="number" min="0" max={v.produced || 0} step="1" value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        {(Number(v.damaged) > 0 || v.produced === '0') && <WorkshopField label="Why were they damaged?" hint="Choose the main cause so the manager can follow up." required options={DEFECT_REASONS} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
        {counted && <ReviewBox arrives><strong className="font-extrabold text-ink">Processed: {v.produced} − damaged: {v.damaged} = {counts.good} pieces to shelf.</strong><p>{counts.yield.toFixed(1)}% good pieces. {size > 1 ? `${counts.shelfUnits} selling packs of ${size} pieces.` : ''}</p></ReviewBox>}
        <WorkshopField label="Raw material actually consumed" hint={`${material.name}: ${units(freeMaterial(material, batches, batch.id), material.unit)} available for this batch. Adjust the planned count if needed.`} required type="number" min="1" max={availableMaterial(material, batches, batch.id)} step="1" value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
        {/* Held back until there is a count to state. It used to read "Add —
            good pieces to Styro Ball 4 inch" before anybody had typed, which
            looks like the screen is broken rather than like it is waiting. */}
        <ReviewBox warning={counted}>
          {counted
            ? <>Deduct {units(Number(v.material_qty) || 0, material.unit)} of {material.name}. Add {counts.good} good pieces to {product.name}; save {v.damaged} damaged pieces in the damage log. The oldest available material lots will be recorded against this batch.</>
            : <>Enter the pieces produced to see exactly what will be added to {product.name} and deducted from {material.name}. The oldest available material lots will be recorded against this batch.</>}
          <p>Checked and approved by {profile.name}. This finishes the batch and cannot be submitted a second time.</p>
        </ReviewBox>
      </>;
    }}
  </WorkshopForm>;
}
