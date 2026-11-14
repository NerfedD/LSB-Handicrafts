import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { availableMaterial, completionCounts, freeMaterial, units } from '../../utils/production';
import { DEFECT_REASONS } from '../../utils/copy';
import { countProblem } from '../../utils/validation';
import { Row } from '../shared/forms';

/**
 * Two steps share this form. With `handoff`, the maker sends the batch to check
 * with the pieces made and damaged (batch_status → Quality Check); nothing on
 * the shelf changes. Without it, the checker finishes the batch: the maker's
 * counts are filled in and can be corrected, material is used up, and good
 * pieces go onto the shelf. Pieces that do not fill a selling pack stay on the
 * shelf as loose pieces until later batches complete the pack.
 */
export default function CompleteBatchDialog({ batch, product, inventory, material, batches, profile, onSave, onClose, handoff = false }) {
  const size = inventory?.packSize || 1;
  const loose = inventory?.loosePieces || 0;
  const allowed = availableMaterial(material, batches, batch.id);

  function validate(v) {
    const produced = countProblem(v.produced, { label: 'The pieces made' });
    const damaged = countProblem(v.damaged, { label: 'The damaged pieces' });
    // The database's line too (private.guard_batch_output, and the same check
    // at Send to check): more than twice the plan is far more likely a slip of
    // the keyboard than a good day.
    const ceiling = 2 * (Number(batch.target_output_qty) || 0);
    const problems = {
      produced: produced
        ?? (Number(v.produced) > ceiling ? `That is more than twice the ${batch.target_output_qty} planned. If that many really came out, a manager changes the batch's target first.` : null),
      damaged: damaged ?? (!produced && Number(v.damaged) > Number(v.produced) ? 'Damaged pieces cannot be more than the pieces made.' : null),
    };
    if (handoff) return problems;
    return {
      ...problems,
      reason: (Number(v.damaged) > 0 || String(v.produced).trim() === '0') && !v.reason ? 'Choose why the pieces were damaged.' : null,
      material_qty: countProblem(v.material_qty, { min: 1, label: 'The material used' })
        ?? (Number(v.material_qty) > allowed ? `Only ${units(Math.max(0, allowed), material.unit)} are available for this batch.` : null),
    };
  }

  const initial = handoff
    ? { id: batch.id, expectedRevision: batch.revision ?? 0, status: 'Quality Check', produced: '', damaged: '0' }
    : { id: batch.id, expectedRevision: batch.revision ?? 0, produced: batch.reported_output_qty ?? '', damaged: String(batch.reported_damaged_qty ?? 0),
        reason: '', material_qty: batch.raw_material_used_qty };

  return <WorkshopForm size="lg" title={handoff ? `Send ${batch.batch_code} to check` : `Count and finish ${batch.batch_code}`}
    description={handoff
      ? `${product.name} · ${batch.target_output_qty} planned. Count what was made; the checker confirms the count before anything goes on the shelf.`
      : `${product.name} · ${batch.target_output_qty} planned. Good pieces go onto the shelf; material is used up now.`}
    submitLabel={handoff ? 'Send to check' : 'Finish batch'} cancelLabel="Not yet"
    initial={initial} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = completionCounts(v.produced, v.damaged, size, loose);
      const counted = v.produced !== '' && counts !== null;
      return <>
        {!handoff && batch.reported_output_qty != null && (
          <p className="m-0 text-13 text-muted-fg">
            The maker counted {batch.reported_output_qty} made and {batch.reported_damaged_qty ?? 0} damaged. Correct the counts if the check found otherwise.
          </p>
        )}
        <Row>
          <WorkshopField name="produced" label="Pieces made" hint="Good and damaged together. 0 for a failed run that still used material." required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.produced} onChange={(e) => change('produced', e.target.value)} />
          <WorkshopField name="damaged" label="Damaged" hint="Logged, not added to stock." required type="number" inputMode="numeric" min="0" step="1" value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        </Row>
        {handoff ? (
          <ReviewBox>
            {counted
              ? <>{v.produced} made, {v.damaged} damaged: {counts.good} good {counts.good === 1 ? 'piece' : 'pieces'} for the checker to confirm.</>
              : <>Enter the pieces made to send the batch to check.</>}
            <p>Nothing on the shelf changes until the checker finishes the batch. Sent by {profile.name}.</p>
          </ReviewBox>
        ) : <>
          {(Number(v.damaged) > 0 || String(v.produced) === '0') && <WorkshopField name="reason" label="Why pieces were damaged" hint="The main cause, so a manager can follow it up." required options={DEFECT_REASONS} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
          <WorkshopField name="material_qty" label={`Material actually used: ${material.name}`} hint={`${units(freeMaterial(material, batches, batch.id), material.unit)} available for this batch. Change the planned amount if more or less was used.`} suffix={material.unit} required type="number" inputMode="numeric" min="1" step="1" value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
          <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-13">
            <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Onto the shelf</dt><dd className="m-0 font-medium">{counted ? `+${counts.good} ${product.name}` : '—'}</dd></div>
            <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Damage rate</dt><dd className="m-0 font-medium">{counted && Number(v.produced) > 0 ? `${(100 - counts.yield).toFixed(1)}%` : '—'}</dd></div>
          </dl>
          <ReviewBox warning={counted}>
            {counted
              ? <>Deducts {units(Number(v.material_qty) || 0, material.unit)} of {material.name} and adds {counts.good} good pieces to {product.name}. {v.damaged} damaged go to the damage log.</>
              : <>Enter the pieces made to see what will be added to {product.name} and deducted from {material.name}.</>}
            {counted && size > 1 && (
              <p>{counts.shelfUnits} new {counts.shelfUnits === 1 ? 'pack' : 'packs'} of {size}; {counts.loosePieces} loose {counts.loosePieces === 1 ? 'piece' : 'pieces'} on the shelf after packing.</p>
            )}
            <p>Checked by {profile.name}. A batch is finished once.</p>
          </ReviewBox>
        </>}
      </>;
    }}
  </WorkshopForm>;
}
