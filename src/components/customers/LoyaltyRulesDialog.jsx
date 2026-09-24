import WorkshopForm, { ReviewBox, WorkshopField } from '../production/WorkshopForm';

const inRange = (value, low, high) => /^\d+(\.\d{1,2})?$/.test(String(value).trim())
  && Number(value) >= low && Number(value) <= high;

/**
 * The loyalty rules, which are deliberately few: when somebody counts as a
 * regular, when they have earned the reward, and what the reward is. The
 * database checks every discount against these same rules (see
 * private.validate_order_promotion), so what is saved here is what is enforced.
 */
export default function LoyaltyRulesDialog({ rules, onSave, onClose }) {
  return (
    <WorkshopForm
      title="Loyalty rules"
      description="Finished orders are counted, across the customer's whole history. Orders still waiting or called off do not count."
      submitLabel="Save the rules"
      initial={{
        revision: rules.revision,
        enabled: rules.enabled ? 'yes' : 'no',
        regularAfterOrders: String(rules.regularAfterOrders),
        rewardAfterOrders: String(rules.rewardAfterOrders),
        rewardPercent: String(rules.rewardPercent),
      }}
      validate={(values) => {
        if (!inRange(values.regularAfterOrders, 1, 1000) || values.regularAfterOrders.includes('.')) return 'A regular needs a whole number of orders, 1 or more.';
        if (!inRange(values.rewardAfterOrders, 1, 1000) || values.rewardAfterOrders.includes('.')) return 'The reward needs a whole number of orders, 1 or more.';
        if (!inRange(values.rewardPercent, 0.01, 50)) return 'The reward is a percentage above 0 and no more than 50.';
        return null;
      }}
      onSave={(values) => onSave({
        revision: values.revision,
        enabled: values.enabled === 'yes',
        regularAfterOrders: Number(values.regularAfterOrders),
        rewardAfterOrders: Number(values.rewardAfterOrders),
        rewardPercent: Number(values.rewardPercent),
      })}
      onClose={onClose}
    >
      {(values, change) => (
        <>
          <WorkshopField label="A customer is a regular after" hint="Finished orders. Shown as a chip on the customers screen."
            type="number" inputMode="numeric" min="1" max="1000" step="1" required
            value={values.regularAfterOrders} onChange={(event) => change('regularAfterOrders', event.target.value)} />
          <WorkshopField label="Give the loyalty reward" required
            options={[{ value: 'yes', label: 'Yes, offer it on new orders' }, { value: 'no', label: 'No, switched off' }]}
            value={values.enabled} onChange={(event) => change('enabled', event.target.value)} />
          <WorkshopField label="The reward starts after" hint="Finished orders."
            type="number" inputMode="numeric" min="1" max="1000" step="1" required
            value={values.rewardAfterOrders} onChange={(event) => change('rewardAfterOrders', event.target.value)} />
          <WorkshopField label="The reward, as a percentage off the items" hint="Not the delivery charge. 50 at most."
            type="number" inputMode="decimal" min="0.01" max="50" step="0.01" required
            value={values.rewardPercent} onChange={(event) => change('rewardPercent', event.target.value)} />
          <ReviewBox>
            {values.enabled === 'yes'
              ? `After ${values.rewardAfterOrders || '?'} finished orders, whoever writes a customer's next order can take ${values.rewardPercent || '?'}% off the items. The order records that the reward was applied.`
              : 'The reward is off. Regulars are still marked on the customers screen.'}
          </ReviewBox>
        </>
      )}
    </WorkshopForm>
  );
}
