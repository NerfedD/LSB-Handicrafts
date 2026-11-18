import { roundMoney } from './money';
import { PAYMENT_METHODS } from './payments';

export const SUPPLIER_PAYMENT_METHODS = [...PAYMENT_METHODS, { value: 'card', label: 'Credit card' }];
export const supplierEntryLabel = (kind) => ({ payment: 'Payment', refund: 'Supplier refund', card_settlement: 'Card-bill payment' }[kind] ?? kind);

/** Confirmed entries only; legacy paid_at markers are not a payment ledger. */
export function supplierBalance(order, entries = []) {
  let paid = 0; let refunded = 0; let credit = 0;
  for (const entry of entries) {
    if (String(entry.order_id) !== String(order.id)) continue;
    const amount = Number(entry.amount) || 0;
    if (entry.kind === 'payment') paid += amount;
    if (entry.kind === 'refund') { refunded += amount; if (entry.reduces_bill) credit += amount; }
  }
  return {
    paid: roundMoney(paid), refunded: roundMoney(refunded), credit: roundMoney(credit),
    outstanding: order.status === 'Cancelled' ? 0 : Math.max(0, roundMoney(Number(order.total_cost) - credit - paid + refunded)),
    refund_due: order.status === 'Cancelled' ? Math.max(0, roundMoney(paid - refunded)) : 0,
  };
}

export function cardBalance(entries = []) {
  return roundMoney(entries.reduce((sum, e) => sum + (e.kind === 'card_settlement' ? -Number(e.amount)
    : e.method === 'card' ? Number(e.amount) * (e.kind === 'refund' ? -1 : 1) : 0), 0));
}
