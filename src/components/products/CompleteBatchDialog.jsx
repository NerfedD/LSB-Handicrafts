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
    const produced = countProblem(v.produced, { label: 'The total count' });
    const damaged = countProblem(v.damaged, { label: 'The damage count' });
    // The database's line too (private.guard_batch_output, and the same check
    // at Send to check): more than twice the plan is far more likely a slip of
    // the keyboard than a good day.
    const ceiling = 2 * (Number(batch.target_output_qty) || 0);
    const problems = {
      produced: produced
        ?? (Number(v.produced) > ceiling ? `Enter ${ceiling} pieces or fewer. Ask a manager to update the planned quantity if needed.` : null),
      damaged: damaged ?? (!produced && Number(v.damaged) > Number(v.produced) ? 'Damaged pieces cannot be more than the pieces made.' : null),
    };
    if (handoff) return problems;
    return {
      ...problems,
      reason: (Number(v.damaged) > 0 || String(v.produced).trim() === '0') && !v.reason ? 'Select a damage reason.' : null,
      material_qty: countProblem(v.material_qty, { min: 1, label: 'Material used' })
        ?? (Number(v.material_qty) > allowed ? `Only ${units(Math.max(0, allowed), material.unit)} are available for this batch.` : null),
    };
  }

  const initial = handoff
    ? { id: batch.id, expectedRevision: batch.revision ?? 0, status: 'Quality Check', produced: '', damaged: '0' }
    : { id: batch.id, expectedRevision: batch.revision ?? 0, produced: batch.reported_output_qty ?? '', damaged: String(batch.reported_damaged_qty ?? 0),
        reason: '', material_qty: batch.raw_material_used_qty };

  return <WorkshopForm size="lg" title={handoff ? `Send ${batch.batch_code} to check` : `Count and finish ${batch.batch_code}`}
    description={handoff
      ? `${product.name} · ${batch.target_output_qty} planned. Enter the actual counts for review.`
      : `${product.name} · ${batch.target_output_qty} planned. Confirm the counts and material used before updating stock.`}
    submitLabel={handoff ? 'Send to check' : 'Finish batch'} cancelLabel="Not yet"
    initial={initial} validate={validate} onSave={onSave} onClose={onClose}>
    {(v, change) => {
      const counts = completionCounts(v.produced, v.damaged, size, loose);
      const counted = v.produced !== '' && counts !== null;
      return <>
        {!handoff && batch.reported_output_qty != null && (
          <p className="m-0 text-13 text-muted-fg">
            The maker reported {batch.reported_output_qty} pieces made and {batch.reported_damaged_qty ?? 0} damaged. Update the counts if needed.
          </p>
        )}
        <Row>
          <WorkshopField name="produced" label="Total pieces made" hint="Include damaged pieces. Enter 0 if the batch produced none." required type="number" inputMode="numeric" min="0" max="2000000000" step="1" value={v.produced} onChange={(e) => change('produced', e.target.value)} />
          <WorkshopField name="damaged" label="Damaged pieces" hint="Enter 0 if none were damaged." required type="number" inputMode="numeric" min="0" step="1" value={v.damaged} onChange={(e) => change('damaged', e.target.value)} />
        </Row>
        {handoff ? (
          <ReviewBox>
            {counted
              ? <>{v.produced} made, {v.damaged} damaged: {counts.good} good {counts.good === 1 ? 'piece' : 'pieces'} for the checker to confirm.</>
              : <>Enter the counts to see how many good pieces are ready for review.</>}
            <p>Stock updates when the checker finishes the batch. Sent by {profile.name}.</p>
          </ReviewBox>
        ) : <>
          {(Number(v.damaged) > 0 || String(v.produced) === '0') && <WorkshopField name="reason" label="Damage reason" hint="Select the main cause." required options={DEFECT_REASONS} value={v.reason} onChange={(e) => change('reason', e.target.value)} />}
          <WorkshopField name="material_qty" label="Material used" hint={`Enter the actual amount of ${material.name} used. ${units(freeMaterial(material, batches, batch.id), material.unit)} available.`} suffix={material.unit} required type="number" inputMode="numeric" min="1" step="1" value={v.material_qty} onChange={(e) => change('material_qty', e.target.value)} />
          <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-13">
            <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Good pieces to shelve</dt><dd className="m-0 font-medium">{counted ? `+${counts.good} ${product.name}` : '—'}</dd></div>
            <div className="bg-card px-3 py-2"><dt className="text-xs text-muted-fg">Damage rate</dt><dd className="m-0 font-medium">{counted && Number(v.produced) > 0 ? `${(100 - counts.yield).toFixed(1)}%` : '—'}</dd></div>
          </dl>
          <ReviewBox warning={counted}>
            {counted
              ? <>Deducts {units(Number(v.material_qty) || 0, material.unit)} of {material.name} and adds {counts.good} good pieces to {product.name}. {v.damaged} damaged pieces will be logged.</>
              : <>Enter the counts to preview the stock changes.</>}
            {counted && size > 1 && (
              <p>{counts.shelfUnits} new {counts.shelfUnits === 1 ? 'pack' : 'packs'} of {size}; {counts.loosePieces} loose {counts.loosePieces === 1 ? 'piece' : 'pieces'} on the shelf after packing.</p>
            )}
            <p>Checked by {profile.name}.</p>
          </ReviewBox>
        </>}
      </>;
    }}
  </WorkshopForm>;
}
