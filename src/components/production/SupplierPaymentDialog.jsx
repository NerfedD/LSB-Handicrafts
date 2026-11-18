import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import WorkshopForm, { ReviewBox, WorkshopField } from './WorkshopForm';
import { localDateIso } from '../../utils/dates';
import { formatPeso, formatShortDate } from '../../utils/profileFormat';
import { PAYMENT_METHODS, paymentMethodLabel } from '../../utils/payments';
import { SUPPLIER_PAYMENT_METHODS, supplierBalance, supplierEntryLabel } from '../../utils/supplierPayments';

export default function SupplierPaymentDialog({ order, kind = 'payment', entries, cardOwed, supplier, onSave, onClose }) {
  const account = order ? supplierBalance(order, entries) : null;
  const limit = kind === 'card_settlement' ? Math.max(0, cardOwed)
    : kind === 'refund' ? account.paid - account.refunded : account.outstanding;
  const title = kind === 'refund' ? 'Record supplier refund' : kind === 'card_settlement' ? 'Record card-bill payment' : 'Record supplier payment';
  const today = localDateIso();
  return (
    <WorkshopForm title={title} description={order ? `Order #${order.id} · ${supplier}` : 'Payment of the pooled card balance recorded in this app.'}
      submitLabel={title} onClose={onClose}
      initial={{ kind, amount: limit.toFixed(2), method: kind === 'card_settlement' ? 'bank' : order?.payment_method === 'card' ? 'card' : 'cash',
        occurred_on: today, reference: '', note: '', reduces_bill: kind === 'refund' && order?.status !== 'Cancelled' }}
      validate={(v) => ({
        amount: Number(v.amount) > limit ? `Enter at most ${formatPeso(limit)}.` : null,
        reference: v.method !== 'cash' && !v.reference.trim() ? 'Enter the reference from the receipt.' : null,
        note: kind === 'refund' && !v.note.trim() ? 'Explain why the supplier refunded this amount.' : null,
        occurred_on: v.occurred_on > today ? 'The payment cannot be dated after today.' : null,
      })}
      onSave={(values, key) => onSave(order?.id ?? null, values, key)}>
      {(v, change) => <>
        <ReviewBox>{kind === 'refund' ? `${formatPeso(limit)} paid and not yet refunded.`
          : kind === 'card_settlement' ? `${formatPeso(limit)} recorded card balance owed.` : `${formatPeso(limit)} still owed to this supplier.`}</ReviewBox>
        <WorkshopField name="amount" label={kind === 'refund' ? 'Amount refunded' : 'Amount paid'} required type="number" inputMode="decimal"
          min="0.01" max={limit.toFixed(2)} step="0.01" value={v.amount} onChange={(e) => change('amount', e.target.value)} />
        <WorkshopField name="method" label="Payment method" required options={kind === 'card_settlement' ? PAYMENT_METHODS : SUPPLIER_PAYMENT_METHODS}
          value={v.method} onChange={(e) => change('method', e.target.value)} />
        <WorkshopField name="occurred_on" label={kind === 'refund' ? 'Date refunded' : 'Date paid'} required type="date" max={today}
          value={v.occurred_on} onChange={(e) => change('occurred_on', e.target.value)} />
        <WorkshopField name="reference" label="Reference number" required={v.method !== 'cash'} maxLength={80}
          hint={v.method === 'cash' ? 'Optional receipt number.' : 'From the receipt, transfer or card transaction. Do not enter a card number.'}
          value={v.reference} onChange={(e) => change('reference', e.target.value)} />
        {kind === 'refund' && order.status !== 'Cancelled' && <WorkshopField name="reduces_bill" label="Does this refund reduce the supplier bill?" required
          options={[{ value: 'yes', label: 'Yes — credit for returned or damaged goods' }, { value: 'no', label: 'No — returned payment, amount is owed again' }]}
          value={v.reduces_bill ? 'yes' : 'no'} onChange={(e) => change('reduces_bill', e.target.value === 'yes')} />}
        <WorkshopField name="note" label={kind === 'refund' ? 'Reason for refund' : 'Note (optional)'} required={kind === 'refund'} multiline maxLength={500}
          value={v.note} onChange={(e) => change('note', e.target.value)} />
        <ReviewBox>{v.method === 'card'
          ? `This records a card ${kind === 'refund' ? 'refund' : 'charge'} and changes the recorded card balance. Cash flow changes when the card bill is paid.`
          : `This records ${formatPeso(v.amount)} ${kind === 'refund' ? 'received back' : 'paid out'} on ${v.occurred_on || 'the chosen date'}.`}
          <p>Save only after checking the payment. This records what happened; it does not transfer money or change sales revenue.</p>
        </ReviewBox>
      </>}
    </WorkshopForm>
  );
}

export function SupplierPaymentHistory({ order, entries, worker, supplier, onRecord, onClose }) {
  const rows = entries.filter((e) => String(e.order_id) === String(order.id)).slice().reverse();
  const account = supplierBalance(order, entries);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>Payments for supplier order #{order.id}</DialogTitle>
        <DialogDescription>{supplier}. Confirmed entries and the balance of the agreed bill.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[['Paid', account.paid], ['Refunded', account.refunded], ['Still owed', account.outstanding], ['Refund due', account.refund_due]].map(([label, value]) =>
            <div key={label}><dt className="text-muted-fg">{label}</dt><dd className="m-0 font-semibold">{formatPeso(value)}</dd></div>)}
        </dl>
        {order.paid_at && <ReviewBox warning>An older automatic paid marker exists for this order. Check the receipt and record the actual payment if it is missing below. The marker is excluded from these totals.</ReviewBox>}
        {rows.length ? <ul aria-label="Supplier payment history" className="m-0 list-none divide-y divide-border p-0">
          {rows.map((e) => <li key={e.id} className="py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{supplierEntryLabel(e.kind)} · {formatPeso(e.amount)}</strong><span>{formatShortDate(e.occurred_on)}</span></div>
            <p className="m-0 text-muted-fg">{e.method === 'card' ? 'Credit card' : paymentMethodLabel(e.method)}{e.reference ? ` · ${e.reference}` : ''} · Recorded by {worker(e.recorded_by)}</p>
            {e.note && <p className="m-0 break-words">{e.note}</p>}
            {e.kind === 'refund' && <p className="m-0 text-muted-fg">{e.reduces_bill ? 'Reduces the supplier bill.' : 'Returns a payment without reducing the bill.'}</p>}
          </li>)}
        </ul> : <p>No confirmed payments have been recorded for this order.</p>}
        <div className="flex flex-wrap gap-2">
          {account.outstanding > 0 && <Button onClick={() => onRecord('payment')}>Record supplier payment</Button>}
          {account.paid > account.refunded && <Button variant="outline" onClick={() => onRecord('refund')}>Record supplier refund</Button>}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
