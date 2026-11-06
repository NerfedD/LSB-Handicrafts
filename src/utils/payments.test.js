import { describe, expect, it } from 'vitest';
import { balanceOf, owingOrders, paidIndex, paymentProblem } from './payments';

const order = (id, total, extra = {}) => ({ id, totalAmount: total, refundedAmount: 0, status: 'Pending', createdAt: `2026-10-0${id}T00:00:00Z`, ...extra });

describe('what is owed', () => {
  const paid = paidIndex([{ orderId: 1, paid: 400 }]);

  it('is the net total less what was paid, never below nothing', () => {
    expect(balanceOf(order(1, 1000), paid)).toBe(600);
    expect(balanceOf(order(1, 1000, { refundedAmount: 700 }), paid)).toBe(0);
    expect(balanceOf(order(2, 300), paid)).toBe(300);
  });

  it('is nothing on a cancelled order', () => {
    expect(balanceOf(order(2, 300, { status: 'Cancelled' }), paid)).toBe(0);
  });

  it('lists the orders still owing, oldest first', () => {
    const orders = [order(3, 200), order(1, 400), order(2, 0)];
    expect(owingOrders(orders, paid).map((o) => o.id)).toEqual([3]);
    expect(owingOrders([order(3, 200), order(2, 50)], new Map()).map((o) => o.id)).toEqual([2, 3]);
  });
});

describe('a payment as typed', () => {
  const ok = { amount: '100', method: 'cash', reference: '', receivedOn: '2026-10-30' };
  const check = (values, owed = 500) => paymentProblem({ ...ok, ...values }, owed, '2026-10-30')?.field ?? null;

  it('accepts a cash payment up to what is owed', () => {
    expect(check({})).toBeNull();
    expect(check({ amount: '500' })).toBeNull();
  });

  it('says which field is wrong', () => {
    expect(check({ amount: '' })).toBe('amount');
    expect(check({ amount: '500.01' })).toBe('amount');
    expect(check({ amount: '10.005' })).toBe('amount');
    expect(check({ method: 'gcash' })).toBe('reference');
    expect(check({ method: 'gcash', reference: 'GC-1' })).toBeNull();
    expect(check({ receivedOn: '2026-10-31' })).toBe('receivedOn');
  });
});
