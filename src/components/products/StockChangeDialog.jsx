import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { COUNT_REASON_OPTIONS, DAMAGE_REASON_OPTIONS } from '../../utils/copy';
import { units } from '../../utils/production';

const wholeCount = (value) => /^\d{1,10}$/.test(String(value).trim());

/**
 * Writing off damaged stock, or setting a count to what is really there.
 *
 * Both go through stock_command, which records who, why and when as a stock
 * movement in the same transaction as the change -- the product form no longer
 * overwrites a count with no reason attached. `expectedStock` carries the count
 * this form was opened against, so a correction made over somebody else's
 * newer change is refused rather than silently undoing it.
 *
 * @param mode    'damage' | 'correct'
 * @param target  'product' | 'material'
 * @param record  { id, name, stock, unit }
 */
export default function StockChangeDialog({ mode, target, record, onSave, onClose }) {
  const damage = mode === 'damage';
  const unit = record.unit || 'unit';

  function validate(values) {
    if (!wholeCount(values.quantity)) return 'Enter a whole number, 0 or more.';
    const amount = Number(values.quantity);
    if (damage && amount < 1) return 'Enter how many were damaged.';
    if (damage && amount > record.stock) return `Only ${units(record.stock, unit)} on the shelf, so ${amount} cannot be written off.`;
    if (!damage && amount === record.stock) return 'That is already the count on record.';
    if (!values.reason) return damage ? 'Choose what happened to it.' : 'Choose why the count is being corrected.';
    if (values.reason === 'other' && !values.note.trim()) return 'Write a short note when the reason is "Something else".';
    return null;
  }

  return (
    <WorkshopForm
      title={damage ? `Record damage: ${record.name}` : `Correct the count: ${record.name}`}
      description={
        damage
          ? `${units(record.stock, unit)} on the shelf. What you write off here comes off the shelf and is kept as a damage record.`
          : `The system says ${units(record.stock, unit)}. Put in what is actually there; the difference is recorded with your name and the reason.`
      }
      submitLabel={damage ? 'Write it off' : 'Save the count'}
      initial={{ target, id: record.id, quantity: '', reason: '', note: '', ...(damage ? {} : { expectedStock: record.stock }) }}
      validate={validate}
      onSave={onSave}
      onClose={onClose}
    >
      {(values, change) => {
        const amount = wholeCount(values.quantity) ? Number(values.quantity) : null;
        return (
          <>
            <WorkshopField
              label={damage ? 'How many are damaged' : 'How many are actually there'}
              hint={damage ? `In ${unit}s, as they are counted on the shelf.` : 'Count what is physically there now.'}
              type="number" inputMode="numeric" min="0" step="1" required
              value={values.quantity}
              onChange={(event) => change('quantity', event.target.value)}
            />
            <WorkshopField
              label={damage ? 'What happened' : 'Why it is being corrected'}
              required
              options={damage ? DAMAGE_REASON_OPTIONS : COUNT_REASON_OPTIONS}
              value={values.reason}
              onChange={(event) => change('reason', event.target.value)}
            />
            <WorkshopField
              label="Note"
              hint={values.reason === 'other' ? 'Needed for "Something else".' : 'Optional: where, or anything worth knowing later.'}
              multiline maxLength={500}
              value={values.note}
              onChange={(event) => change('note', event.target.value)}
            />
            {amount !== null && (damage ? amount > 0 && amount <= record.stock : amount !== record.stock) ? (
              <ReviewBox warning={damage} arrives>
                <strong className="font-extrabold text-ink">
                  {damage
                    ? `${record.stock} − ${amount} damaged = ${record.stock - amount} left on the shelf.`
                    : `${record.stock} → ${amount}: ${amount > record.stock ? 'up' : 'down'} by ${Math.abs(amount - record.stock)}.`}
                </strong>
                <p>This is added to the stock history and cannot be deleted. A mistake is corrected with another entry.</p>
              </ReviewBox>
            ) : (
              <ReviewBox>Nothing changes until you save below.</ReviewBox>
            )}
          </>
        );
      }}
    </WorkshopForm>
  );
}
