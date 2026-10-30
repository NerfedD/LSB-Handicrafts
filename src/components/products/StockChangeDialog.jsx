import { useState } from 'react';

import { ToggleGroup } from '@/components/ui/toggle-group';
import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';
import { COUNT_REASON_OPTIONS, DAMAGE_REASON_OPTIONS } from '../../utils/copy';
import { pluralUnit, units } from '../../utils/production';

const wholeCount = (value) => /^\d{1,10}$/.test(String(value).trim());

/**
 * Count or write off stock, drawn to the "Count or write off stock · Dialog"
 * board: the item's name, what the system has on hand, and the switch between
 * "Count what's there" and "Write off damage" when the person may do both.
 *
 * Both go through stock_command, which records who, why and when as a stock
 * movement in the same transaction as the change. `expectedStock` carries the
 * count this form was opened against, so a correction made over somebody
 * else's newer change is refused rather than silently undoing it.
 *
 * @param mode       'damage' | 'correct', the side it opens on
 * @param target     'product' | 'material'
 * @param record     { id, name, stock, unit }
 * @param canCorrect / canDamage  offer the other side too
 * @param onSave     (values, requestId, mode)
 */
export default function StockChangeDialog({ mode: initialMode, target, record, canCorrect, canDamage, onSave, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const damage = mode === 'damage';
  const unit = record.unit || 'unit';
  const both = Boolean(canCorrect && canDamage);

  function validate(values) {
    const amount = Number(values.quantity);
    const quantity = !wholeCount(values.quantity) ? 'Enter a whole number, 0 or more, without decimals.'
      : damage && amount < 1 ? 'Enter how many were damaged.'
        : damage && amount > record.stock ? `Only ${units(record.stock, unit)} on hand, so ${amount} cannot be written off.`
          : !damage && amount === record.stock ? 'That is already the count on record.'
            : null;
    return {
      quantity,
      reason: values.reason ? null : damage ? 'Choose what happened to it.' : 'Choose why the count is different.',
      note: values.reason === 'other' && !values.note.trim() ? 'Write a short note when the reason is "Something else".' : null,
    };
  }

  return (
    <WorkshopForm
      key={mode}
      size="default"
      title={record.name}
      description={`The system has ${units(record.stock, unit)} on hand.`}
      submitLabel={damage ? 'Write off' : 'Save count'}
      initial={{ target, id: record.id, quantity: '', reason: '', note: '', ...(damage ? {} : { expectedStock: record.stock }) }}
      validate={validate}
      onSave={(values, requestId) => onSave(values, requestId, mode)}
      onClose={onClose}
    >
      {(values, change) => {
        const amount = wholeCount(values.quantity) ? Number(values.quantity) : null;
        return (
          <>
            {both ? (
              <ToggleGroup
                label="What to record"
                className="w-full"
                value={mode}
                onValueChange={setMode}
                options={[
                  { value: 'correct', label: "Count what's there" },
                  { value: 'damage', label: 'Write off damage' },
                ]}
              />
            ) : null}
            <WorkshopField
              name="quantity"
              label={damage ? 'How much to write off' : 'You counted'}
              hint={damage ? undefined : 'Count what is physically there now.'}
              suffix={pluralUnit(unit, 2)}
              type="number" inputMode="numeric" min="0" step="1" required
              value={values.quantity}
              onChange={(event) => change('quantity', event.target.value)}
            />
            {!damage && amount !== null && amount !== record.stock ? (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-13">
                <span className="text-muted-fg">Difference</span>
                <span className="font-medium">{amount > record.stock ? '+' : '−'}{Math.abs(amount - record.stock)} {pluralUnit(unit, Math.abs(amount - record.stock))}</span>
              </div>
            ) : null}
            <WorkshopField
              name="reason"
              label={damage ? 'What happened' : 'Most likely reason'}
              required
              options={damage ? DAMAGE_REASON_OPTIONS : COUNT_REASON_OPTIONS}
              value={values.reason}
              onChange={(event) => change('reason', event.target.value)}
            />
            {damage && amount !== null && amount > 0 && amount <= record.stock ? (
              <p className="m-0 text-13 text-muted-fg">
                Leaves {units(record.stock - amount, unit)} on hand. A manager can undo this from the stock history.
              </p>
            ) : null}
            <WorkshopField
              name="note"
              label={<>Note <span className="font-normal text-muted-fg">(optional)</span></>}
              hint={values.reason === 'other' ? 'Needed for "Something else".' : undefined}
              placeholder="Where, who noticed, anything that helps next time"
              maxLength={500}
              value={values.note}
              onChange={(event) => change('note', event.target.value)}
            />
            {amount === null ? <ReviewBox>Nothing changes until you save below. Every change is kept in the stock history.</ReviewBox> : null}
          </>
        );
      }}
    </WorkshopForm>
  );
}
