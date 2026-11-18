import { describe, expect, it } from 'vitest';
import { cardBalance, supplierBalance } from './supplierPayments';

describe('supplier balances displayed in Purchasing', () => {
  const order = { id: 1, total_cost: 3000, status: 'Arrived', paid_at: '2026-11-01T00:00:00Z' };
  const payment = { order_id: 1, kind: 'payment', method: 'cash', amount: 1000 };
  it('uses explicit payments, includes centavos and ignores another order', () => {
    expect(supplierBalance(order)).toMatchObject({ paid: 0, outstanding: 3000 });
    expect(supplierBalance(order, [payment, { ...payment, order_id: 2 }])).toMatchObject({ paid: 1000, outstanding: 2000 });
    expect(supplierBalance({ ...order, total_cost: 0.3 }, [{ ...payment, amount: 0.1 }]).outstanding).toBe(0.2);
  });
  it('reopens the balance for a returned payment, but not for a purchase credit', () => {
    const refund = { order_id: 1, kind: 'refund', method: 'cash', amount: 200 };
    expect(supplierBalance(order, [payment, refund]).outstanding).toBe(2200);
    expect(supplierBalance(order, [payment, { ...refund, reduces_bill: true }]).outstanding).toBe(2000);
    expect(supplierBalance({ ...order, status: 'Cancelled' }, [payment, refund])).toMatchObject({ outstanding: 0, refund_due: 800 });
  });
  it('separates card charges, card credits and card-bill payments from cash purchases', () => {
    expect(cardBalance([payment, { ...payment, method: 'card', amount: 500 },
      { ...payment, kind: 'refund', method: 'card', amount: 100 },
      { kind: 'card_settlement', method: 'bank', amount: 300 }])).toBe(100);
  });
});
