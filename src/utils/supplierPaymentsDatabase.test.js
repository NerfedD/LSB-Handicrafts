import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, readSql, signIn, STAFF } from '../test/database';

let db;
let next = 88000;
beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, 'admin'); });
const today = async () => (await one(db, `select private.shop_today()::text as d`)).d;
async function order(total = 3000, method = 'cod') {
  const id = ++next;
  await db.query(`insert into public.suppliers(id,name) values ($1,'Foam supplier')`, [id]);
  await db.query(`insert into public.raw_materials(id,sku,name,unit) values ($1,$2,'Sheet','sheet')`, [id, `PAY-${id}`]);
  return (await one(db, `insert into public.raw_material_orders(supplier_id,raw_material_id,quantity_ordered,unit_price,created_by_staff_id,payment_method)
    values ($1,$1,1,$2,$3,$4) returning *`, [id, total, STAFF.manager.id, method]));
}
const record = async (id, amount, extra = {}, who = 'manager', key = crypto.randomUUID()) => asApi(db, who, async () =>
  (await one(db, 'select public.record_supplier_payment($1,$2,$3) as r',
    [id, JSON.stringify({ kind: 'payment', amount, method: 'cash', occurred_on: await today(), ...extra }), key])).r);
const balance = async (id) => asApi(db, 'manager', async () => (await one(db,
  'select public.supplier_payment_account($1) as r', [id])).r);
const summary = async (from, to) => asApi(db, 'manager', async () => (await one(db,
  'select public.cash_flow_summary($1::date,$2::date) as r', [from, to])).r);

describe('confirmed supplier payments', () => {
  it('requires an explicit entry, supports partial payments, and replays retries', async () => {
    const o = await order();
    await db.query(`update public.raw_material_orders set status='Arrived' where id=$1`, [o.id]);
    expect((await balance(o.id)).outstanding).toBe(3000);
    const key = crypto.randomUUID();
    await record(o.id, 1000, {}, 'manager', key);
    expect((await record(o.id, 1000, {}, 'manager', key)).replayed).toBe(true);
    expect(await balance(o.id)).toMatchObject({ paid: 1000, refunded: 0, outstanding: 2000 });
    await expect(record(o.id, 2100)).rejects.toThrow(/more than.*owed/i);
    await expect(record(o.id, 500, {}, 'manager', key)).rejects.toThrow(/different/i);
    expect((await all(db, 'select * from public.supplier_payments where order_id=$1', [o.id]))).toHaveLength(1);
  });
  it('separates a supplier credit from a returned payment, and retains cancelled history', async () => {
    const o = await order();
    await record(o.id, 2000);
    await record(o.id, 300, { kind: 'refund', reduces_bill: true, note: 'Damaged sheets' });
    expect(await balance(o.id)).toMatchObject({ outstanding: 1000, refunded: 300, credit: 300 });
    await record(o.id, 200, { kind: 'refund', reduces_bill: false, note: 'Deposit returned' });
    expect((await balance(o.id)).outstanding).toBe(1200);
    await db.query(`update public.raw_material_orders set status='Cancelled' where id=$1`, [o.id]);
    expect(await balance(o.id)).toMatchObject({ outstanding: 0, refund_due: 1500 });
    await expect(record(o.id, 10)).rejects.toThrow(/cancelled/i);
    await expect(record(o.id, 1501, { kind: 'refund', note: 'Returned deposit' })).rejects.toThrow(/more than.*paid/i);
    await expect(db.query('delete from public.raw_material_orders where id=$1', [o.id])).rejects.toThrow(/foreign key|financial history/i);
    await record(o.id, 1500, { kind: 'refund', note: 'Returned deposit' });
    expect((await balance(o.id)).refund_due).toBe(0);
  });
  it('validates amounts, dates, references and role permissions on the server', async () => {
    const o = await order();
    await expect(record(o.id, 1, {}, 'sales')).rejects.toThrow(/manager/i);
    await expect(asApi(db, 'production', () => one(db, 'select public.supplier_payment_account($1)', [o.id]))).rejects.toThrow(/manager/i);
    await expect(record(o.id, 0)).rejects.toThrow(/amount/i);
    await expect(record(o.id, 'NaN')).rejects.toThrow(/amount/i);
    await expect(record(o.id, 1.001)).rejects.toThrow(/decimal/i);
    await expect(record(o.id, 10, { method: 'bank' })).rejects.toThrow(/reference/i);
    await expect(record(o.id, 10, { occurred_on: '2099-01-01' })).rejects.toThrow(/today/i);
    await expect(record(o.id, 10, { method: 'crypto' })).rejects.toThrow(/method/i);
    await expect(record(o.id, 10, {}, null)).rejects.toThrow(/manager/i);
    await expect(asApi(db, 'admin', () => db.query(`insert into public.supplier_payments(order_id,kind,amount,method,occurred_on,recorded_by,request_id)
      values ($1,'payment',10,'cash',current_date,$2,gen_random_uuid())`, [o.id, STAFF.admin.id]))).rejects.toThrow(/permission denied/i);
    expect(await asApi(db, 'sales', () => all(db, 'select * from public.supplier_payments'))).toEqual([]);
  });
  it('does not infer a payment from selecting card or receiving COD', async () => {
    const card = await order(3000, 'card');
    expect(card.paid_at).toBeNull();
    expect((await balance(card.id)).outstanding).toBe(3000);
  });
  it('prevents editing a bill below its confirmed settlements', async () => {
    const o = await order();
    await record(o.id, 1000);
    await expect(db.query('update public.raw_material_orders set unit_price=500 where id=$1', [o.id])).rejects.toThrow(/payment|settled/i);
  });
  it('keeps card charges out of cash flow and records card-bill payments once', async () => {
    const day = await today();
    const before = await summary(day, day);
    const o = await order(1000, 'card');
    await record(o.id, 1000, { method: 'card', reference: 'CARD-123' });
    const charged = await summary(day, day);
    expect(charged.card_balance - before.card_balance).toBe(1000);
    expect(charged.net_cash).toBe(before.net_cash);
    await record(null, 600, { kind: 'card_settlement', method: 'bank', reference: 'BILL-123' });
    const settled = await summary(day, day);
    expect(settled.card_balance - before.card_balance).toBe(400);
    expect(settled.net_cash - before.net_cash).toBe(-600);
    await record(o.id, 200, { kind: 'refund', method: 'card', reference: 'RETURN-123', reduces_bill: true, note: 'Returned goods' });
    const refunded = await summary(day, day);
    expect(refunded.card_balance - before.card_balance).toBe(200);
    expect(refunded.net_cash).toBe(settled.net_cash);
    expect((await balance(o.id)).outstanding).toBe(0);
  });
  it('uses transaction dates, counts only actual customer cash refunds and excludes unpaid purchases', async () => {
    const day = await today();
    const before = await summary(day, day);
    const o = await order(500);
    await record(o.id, 100, { occurred_on: '2020-01-01' });
    expect((await summary(day, day)).net_cash).toBe(before.net_cash);
    await record(o.id, 200);
    const id = ++next;
    await db.query(`insert into public.orders(id,customer_name,items,total_amount) values ($1,'Buyer',$2,1000)`,
      [id, JSON.stringify([{ kind: 'custom', name: 'Decor', quantity: 1, unitPrice: 1000, lineTotal: 1000 }])]);
    await asApi(db, 'sales', () => one(db, 'select public.record_payment($1,500,\'cash\',null,$2::date,null,$3)', [[id], day, crypto.randomUUID()]));
    const result = await summary(day, day);
    expect(result.customer_collections - before.customer_collections).toBe(500);
    expect(result.supplier_payments - before.supplier_payments).toBe(200);
    expect(result.net_cash - before.net_cash).toBe(300);
    // Of a 700 peso refund, 200 is handed back and 500 reduces the unpaid bill.
    // Use the real refund-money trigger; only handedBack belongs in cash flow.
    await signIn(db, 'admin');
    await db.query(`update public.orders set refunded_amount=700, refund_history=$2 where id=$1`,
      [id, JSON.stringify([{ amount: 700, method: 'cash', refundedAt: `${day}T16:00:00+08:00` }])]);
    const afterRefund = await summary(day, day);
    expect(afterRefund.customer_refunds - before.customer_refunds).toBe(200);
    expect(afterRefund.net_cash - before.net_cash).toBe(100);
    // The Manila calendar date differs from UTC for an early morning entry.
    await signIn(db, 'admin');
    await db.query(`update public.orders set refund_history=$2 where id=$1`,
      [id, JSON.stringify([{ amount: 700, handedBack: 200, method: 'cash', refundedAt: `${day}T01:00:00+08:00` }])]);
    expect((await summary(day, day)).customer_refunds).toBe(afterRefund.customer_refunds);
    await expect(summary(day, '2020-01-01')).rejects.toThrow(/date|range/i);
    await expect(asApi(db, 'sales', () => one(db, 'select public.cash_flow_summary($1::date,$1::date)', [day]))).rejects.toThrow(/manager/i);
  });
  it('can refund a card-funded purchase in cash without reducing the card debt', async () => {
    const day = await today();
    const before = await summary(day, day);
    const o = await order(1000);
    await record(o.id, 1000, { method: 'card', reference: 'CARD-CASH-REFUND' });
    await record(o.id, 200, { kind: 'refund', method: 'cash', reduces_bill: true, note: 'Supplier returned cash' });
    const result = await summary(day, day);
    expect(result.card_balance - before.card_balance).toBe(1000);
    expect(result.net_cash - before.net_cash).toBe(200);
  });
  it('preserves confirmed entries if the schema and migration run again', async () => {
    const o = await order(100);
    await record(o.id, 50);
    await signIn(db, null);
    await db.exec(readSql('schema.sql'));
    expect(await balance(o.id)).toMatchObject({ paid: 50, outstanding: 50 });
    const newCard = await order(100, 'card');
    expect(newCard.paid_at).toBeNull();
  });
  it('keeps old inferred paid markers without turning them into confirmed entries', async () => {
    const o = await order(150);
    await signIn(db, null);
    await db.query('update public.raw_material_orders set paid_at=now() where id=$1', [o.id]);
    await db.exec(readSql('migrations/20261118152541_supplier_payment_ledger.sql'));
    expect((await one(db, 'select paid_at from public.raw_material_orders where id=$1', [o.id])).paid_at).not.toBeNull();
    expect(await balance(o.id)).toMatchObject({ paid: 0, outstanding: 150 });
  });
});
