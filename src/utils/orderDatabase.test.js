// order_command against the real schema in PGlite (see src/test/database.js).
// One connection: these prove stale-snapshot rejection and rollback, not lock
// contention between independent PostgreSQL connections.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, rpc, signIn } from '../test/database';
import { commitOrder, commitPartialDelivery, handleRefundStock, uncommitOrder } from './stockLedger';

let db;
const line = (quantity = 4, productId = 101) =>
  ({ productId, name: 'Sheets', quantity, stockUnits: quantity, unitPrice: 150, kind: 'catalog' });

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`
    delete from public.stock_movements; delete from public.deliveries; delete from public.orders;
    delete from public.inventory; delete from private.order_requests;
    insert into public.inventory (id, sku, name, category, stock) values
      (101, 'SS-100', 'Sheets', 'Test', 64), (102, 'SB-040', 'Balls', 'Test', 20);
    insert into public.deliveries (id, product, location, status) values
      (11, 'Order #1 - Test', 'Davao', 'Ready To Go'), (12, 'Order #2 - Test', 'Davao', 'Ready To Go');`);
  await db.query(`insert into public.orders (id, customer_name, items, total_amount) values
    (1, 'Test', $1, 600), (2, 'Test', $2, 1200)`, [JSON.stringify([line()]), JSON.stringify([line(8)])]);
  await signIn(db, 'admin');
});

async function order(id = 1) {
  const row = await one(db, 'select * from public.orders where id = $1', [id]);
  return { id: row.id, revision: Number(row.revision), items: row.items, status: row.status,
    stockCommittedAt: row.stock_committed_at, refundedAmount: Number(row.refunded_amount),
    refundHistory: row.refund_history, replacementHistory: row.replacement_history, totalAmount: Number(row.total_amount) };
}
const stocks = async () => (await all(db, 'select stock from public.inventory order by id')).map((row) => row.stock);
const command = (action, data, requestId) => rpc(db, 'order_command', action, data, requestId);

function complete(source) {
  const moved = commitOrder([], source);
  return { orderId: source.id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt, status: 'Completed' } };
}

function refund(source, amount = 150, { units = 1, disposition = 'restock', status } = {}) {
  const moved = handleRefundStock([], source, [{ lineIndex: 0, units, disposition }]);
  return { orderId: source.id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, refundedAmount: source.refundedAmount + amount, status: status ?? source.status,
      refundHistory: [...source.refundHistory, { id: crypto.randomUUID(), amount, refundedBy: 'Somebody else' }] } };
}

const replace = (source, extra = {}) => ({ orderId: source.id, expectedRevision: source.revision,
  lineIndex: 0, quantity: 2, disposition: 'scrap', reason: 'damaged', ...extra });

describe('order transactions', () => {
  it('completes against database stock even while the browser shelf is empty', async () => {
    await command('complete', complete(await order()));
    expect(await stocks()).toEqual([60, 20]);
    expect((await order()).status).toBe('Completed');
  });

  it('keeps both deductions from different orders that read the same shelf', async () => {
    const a = complete(await order(1));
    const b = complete(await order(2));
    await Promise.all([command('complete', a), command('complete', b)]);
    expect(await stocks()).toEqual([52, 20]);
  });

  it('rolls back every shelf row when a later product is missing', async () => {
    await db.query('update public.orders set items = $1 where id = 1', [JSON.stringify([line(), line(3, 999)])]);
    await expect(command('complete', complete(await order()))).rejects.toThrow(/not on the shelf/);
    expect(await stocks()).toEqual([64, 20]);
    expect((await order()).status).toBe('Pending');
    expect(await all(db, 'select * from private.order_requests')).toHaveLength(0);
    expect(await all(db, "select * from public.stock_movements where kind <> 'opening'")).toHaveLength(0);
  });

  it('rolls back stock and order when stock would become negative', async () => {
    await signIn(db, null);
    await db.exec('update public.inventory set stock = 2 where id = 101');
    await signIn(db, 'admin');
    await expect(command('complete', complete(await order()))).rejects.toThrow(/not enough/);
    expect(await stocks()).toEqual([2, 20]);
    expect((await order()).status).toBe('Pending');
  });

  it('replays a lost response without moving stock a second time', async () => {
    const payload = complete(await order());
    const id = crypto.randomUUID();
    const first = await command('complete', payload, id);
    expect(await command('complete', payload, id)).toEqual(first);
    expect(await stocks()).toEqual([60, 20]);
  });

  it('rejects a changed payload under a previously used request key', async () => {
    const payload = complete(await order());
    const id = crypto.randomUUID();
    await command('complete', payload, id);
    await expect(command('complete', { ...payload, orderId: 2 }, id)).rejects.toThrow(/request has changed/);
  });

  it('refuses a stale refund without restoring stock or dropping newer history', async () => {
    await command('complete', complete(await order()));
    const source = await order();
    await command('refund', refund(source));
    await expect(command('refund', refund(source))).rejects.toThrow(/order changed/);
    expect(await stocks()).toEqual([61, 20]);
    expect((await order()).refundHistory).toHaveLength(1);
    expect((await order()).refundedAmount).toBe(150);
  });

  it('rejects a second stale dispatch without taking stock twice', async () => {
    const source = await order();
    const moved = commitPartialDelivery([], source, [{ lineIndex: 0, units: 2 }]);
    const payload = { orderId: 1, deliveryId: 11, expectedRevision: 0, expectedDeliveryRevision: 0,
      deltas: moved.deltas, order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt },
      delivery: { status: 'On The Way' } };
    await command('dispatch', payload);
    await expect(command('dispatch', payload)).rejects.toThrow(/order changed/);
    expect(await stocks()).toEqual([62, 20]);
  });

  it('does not dispatch a cancelled order', async () => {
    await signIn(db, null);
    await db.exec("update public.orders set status = 'Cancelled' where id = 1");
    await signIn(db, 'admin');
    await expect(command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: 1, expectedDeliveryRevision: 0,
      order: {}, delivery: { status: 'On The Way' } })).rejects.toThrow(/called off/);
    expect(await stocks()).toEqual([64, 20]);
  });

  it('rejects a delivery belonging to another order, by id as well as by text', async () => {
    await expect(command('dispatch', { orderId: 1, deliveryId: 12, expectedRevision: 0, expectedDeliveryRevision: 0 }))
      .rejects.toThrow(/different order/);
    await db.exec(`insert into public.deliveries (id, product, location, status, order_id)
      values (13, 'Order #1 - Test', 'Davao', 'Ready To Go', 2)`);
    await expect(command('dispatch', { orderId: 1, deliveryId: 13, expectedRevision: 0, expectedDeliveryRevision: 0 }))
      .rejects.toThrow(/different order/);
  });

  it('returns only what a partial dispatch took when the order is cancelled', async () => {
    const moved = commitPartialDelivery([], await order(), [{ lineIndex: 0, units: 2 }]);
    await command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: 0, expectedDeliveryRevision: 0,
      deltas: moved.deltas, order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt }, delivery: { status: 'On The Way' } });
    const source = await order();
    const back = uncommitOrder([], source);
    await command('cancel', { orderId: 1, expectedRevision: source.revision, deltas: back.deltas,
      order: { items: back.items, status: 'Cancelled', stockCommittedAt: null } });
    expect(await stocks()).toEqual([64, 20]);
  });

  it('takes an unsent delivery off the board with the cancelled order, in the same transaction', async () => {
    const source = await order(2);
    const result = await command('cancel', { orderId: 2, expectedRevision: source.revision, deltas: [],
      order: { items: source.items, status: 'Cancelled', stockCommittedAt: null } });
    expect(result.removedDeliveries).toEqual([12]);
    expect(await all(db, 'select id from public.deliveries where id = 12')).toEqual([]);
  });

  it('refuses arbitrary shelf deltas unrelated to the committed quantities', async () => {
    const payload = complete(await order());
    payload.deltas[0].delta = 100;
    await expect(command('complete', payload)).rejects.toThrow(/shelf movement/);
    expect(await stocks()).toEqual([64, 20]);
  });

  it('requires a revision instead of accepting an older client blindly', async () => {
    const payload = complete(await order());
    delete payload.expectedRevision;
    await expect(command('complete', payload)).rejects.toThrow(/order changed/);
  });

  it('increments revisions for ordinary edits as well as commands', async () => {
    await db.exec("update public.orders set customer_name = 'Updated' where id = 1");
    expect((await order()).revision).toBe(1);
    await command('complete', complete(await order()));
    expect((await order()).revision).toBe(2);
  });
});

describe('refunds', () => {
  it('stamps who gave the money back and when from the database, not the browser', async () => {
    await command('complete', complete(await order()));
    await command('refund', refund(await order()));
    const [entry] = (await order()).refundHistory;
    expect(entry).toMatchObject({ amount: 150, refundedBy: 'admin person', refundedByStaffId: 11 });
    expect(Date.parse(entry.refundedAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('refuses a refund entry that does not match the money moved', async () => {
    await command('complete', complete(await order()));
    const payload = refund(await order());
    payload.order.refundHistory.at(-1).amount = 20;
    await expect(command('refund', payload)).rejects.toThrow(/does not match the amount/);
  });

  it('calls the order off on a full refund, and only then', async () => {
    await command('complete', complete(await order()));
    await expect(command('refund', refund(await order(), 150, { status: 'Cancelled' })))
      .rejects.toThrow(/partial refund does not change/);
    await expect(command('refund', refund(await order(), 600, { units: 4 })))
      .rejects.toThrow(/calls the order off/);
    await command('refund', refund(await order(), 600, { units: 4, status: 'Cancelled' }));
    expect((await order()).status).toBe('Cancelled');
    expect(await stocks()).toEqual([64, 20]);
  });
});

describe('replacements', () => {
  const movements = () => all(db, 'select inventory_id, kind, quantity_change, order_id from public.stock_movements order by id');

  it('scraps what came back and sends the same product out once, leaving the money alone', async () => {
    await command('complete', complete(await order()));
    const key = crypto.randomUUID();
    const first = await command('replace', replace(await order()), key);
    expect(await command('replace', replace({ ...(await order()), revision: 1 }), key)).toEqual(first);
    expect(await stocks()).toEqual([58, 20]);
    const saved = await order();
    expect(saved).toMatchObject({ status: 'Completed', refundedAmount: 0, totalAmount: 600 });
    expect(saved.replacementHistory).toEqual([expect.objectContaining({
      lineIndex: 0, quantity: 2, disposition: 'scrap', reason: 'damaged', replacementProductId: 101,
      replacementQuantity: 2, handledBy: 'admin person', handledByStaffId: 11,
    })]);
    expect((await movements()).at(-1)).toEqual({ inventory_id: 101, kind: 'replacement', quantity_change: -2, order_id: 1 });
  });

  it('puts sellable returns back on the shelf and can replace with a different product', async () => {
    await command('complete', complete(await order()));
    await command('replace', replace(await order(), { disposition: 'restock', replacementProductId: 102, replacementQuantity: 3, reason: 'wrong' }));
    expect(await stocks()).toEqual([62, 17]);
    expect((await movements()).slice(-2).map((m) => `${m.kind} ${m.inventory_id} ${m.quantity_change}`))
      .toEqual(['return 101 2', 'replacement 102 -3']);
  });

  it('allows no more back than the customer received on that line', async () => {
    await expect(command('replace', replace(await order()))).rejects.toThrow(/up to 0 on this line/);
    const moved = commitPartialDelivery([], await order(), [{ lineIndex: 0, units: 1 }]);
    await command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: 0, expectedDeliveryRevision: 0,
      deltas: moved.deltas, order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt }, delivery: { status: 'On The Way' } });
    await expect(command('replace', replace(await order()))).rejects.toThrow(/up to 1 on this line/);
    expect(await stocks()).toEqual([63, 20]);
  });

  it('counts what has already gone back, so one line cannot be replaced twice over', async () => {
    await command('complete', complete(await order()));
    await command('replace', replace(await order(), { quantity: 4 }));
    expect(await stocks()).toEqual([56, 20]);
    await expect(command('replace', replace(await order(), { quantity: 4 })))
      .rejects.toThrow(/up to 0 on this line/);
    expect(await stocks()).toEqual([56, 20]);
  });

  it('reads legacy orders that were stamped done before the per-line counters existed', async () => {
    await signIn(db, null);
    await db.exec(`update public.orders set status = 'Completed', stock_committed_at = now() where id = 1`);
    await signIn(db, 'admin');
    await command('replace', replace(await order(), { quantity: 4 }));
    expect(await stocks()).toEqual([60, 20]);
  });

  it('refuses when the replacement is not on the shelf, changing nothing', async () => {
    await command('complete', complete(await order()));
    await expect(command('replace', replace(await order(), { disposition: 'restock', replacementProductId: 102, replacementQuantity: 21 })))
      .rejects.toThrow(/Only 20 of Balls/);
    expect(await stocks()).toEqual([60, 20]);
    expect((await order()).replacementHistory).toEqual([]);
  });

  it('is for managers and administrators, and not for a called-off or stale order', async () => {
    await command('complete', complete(await order()));
    const source = await order();
    await signIn(db, 'sales');
    await expect(command('replace', replace(source))).rejects.toThrow(/administrator or a manager/);
    await signIn(db, 'manager');
    await expect(command('replace', replace({ ...source, revision: 0 }))).rejects.toThrow(/order changed/);
    await signIn(db, null);
    await db.exec("update public.orders set status = 'Cancelled' where id = 1");
    await signIn(db, 'manager');
    await expect(command('replace', replace(await order()))).rejects.toThrow(/called off/);
  });
});

describe('manager-only changes', () => {
  it.each(['name', 'notes', 'stockUnits', 'lineTotal', 'kind'])('guards the %s field against direct staff updates', async (field) => {
    const items = [line()];
    items[0][field] = ['stockUnits', 'lineTotal'].includes(field) ? 999 : 'changed';
    await asApi(db, 'sales', async () => {
      await expect(db.query('update public.orders set items = $1 where id = 1', [JSON.stringify(items)]))
        .rejects.toThrow(/administrator or a manager/);
    });
  });

  it.each([
    ['replacement_history', `'[{"quantity": 9}]'::jsonb`],
    ['discount_amount', '50'],
  ])('guards %s against direct staff updates', async (column, value) => {
    await asApi(db, 'sales', async () => {
      await expect(db.query(`update public.orders set ${column} = ${value} where id = 1`))
        .rejects.toThrow(/administrator or a manager/);
    });
  });

  it('permits staff to complete without changing the agreed lines', async () => {
    await signIn(db, 'sales');
    await command('complete', complete(await order()));
    expect(await stocks()).toEqual([60, 20]);
  });

  it('refuses staff cancellation through the command', async () => {
    await signIn(db, 'sales');
    await expect(command('cancel', { orderId: 1, expectedRevision: 0, order: { status: 'Cancelled' } }))
      .rejects.toThrow(/administrator or a manager/);
  });
});
