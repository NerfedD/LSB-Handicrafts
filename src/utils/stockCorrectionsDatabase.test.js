// The medium-risk fixes of the November 2026 audit, against the real schema in
// PGlite (see src/test/database.js): goods counted back where they really are,
// records that cannot be quietly rewritten, and role lines the screens draw.
// See supabase/migrations/20261113120000_stock_and_delivery_corrections.sql.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, rpc, signIn } from '../test/database';
import { commitOrder, commitPartialDelivery, handleRefundStock, uncommitOrder } from './stockLedger';

let db;
const line = (quantity = 4, productId = 101, extra = {}) =>
  ({ productId, name: productId === 101 ? 'Sheets' : 'Balls', quantity, stockUnits: quantity, unitPrice: 150, kind: 'catalog', ...extra });

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await signIn(db, null);
  await db.exec(`
    delete from public.order_payments; delete from public.stock_movements; delete from public.deliveries;
    delete from public.orders; delete from public.production_material_usage; delete from public.production_defect_logs;
    delete from public.production_batches; delete from public.inventory; delete from public.products;
    delete from private.order_requests;
    insert into public.products (id, item_code, name) values (901, 'SS-100', 'Sheets'), (902, 'SB-040', 'Balls');
    insert into public.inventory (id, sku, name, category, stock) values
      (101, 'SS-100', 'Sheets', 'Test', 64), (102, 'SB-040', 'Balls', 'Test', 20);`);
  await db.query(`insert into public.orders (id, customer_name, items, total_amount, created_at) values
    (1, 'First', $1, 600, now() - interval '2 days')`, [JSON.stringify([line()])]);
  await db.exec(`insert into public.deliveries (id, product, location, status, order_id) values
    (11, 'Order #1 - First', 'Davao', 'Ready To Go', 1)`);
  await signIn(db, 'admin');
});

async function order(id = 1) {
  const row = await one(db, 'select * from public.orders where id = $1', [id]);
  return { id: row.id, revision: Number(row.revision), items: row.items, status: row.status,
    stockCommittedAt: row.stock_committed_at, refundedAmount: Number(row.refunded_amount),
    refundHistory: row.refund_history, replacementHistory: row.replacement_history,
    totalAmount: Number(row.total_amount), priceAdjustments: row.price_adjustments };
}
const stock = async (id = 101) => (await one(db, 'select stock from public.inventory where id = $1', [id])).stock;
const run = (id = 11) => one(db, 'select * from public.deliveries where id = $1', [id]);
const command = (action, data) => rpc(db, 'order_command', action, data);
const write = (who, sql, params = []) => asApi(db, who, () => db.query(sql, params));

async function complete(id = 1) {
  const source = await order(id);
  const moved = commitOrder([], source);
  return command('complete', { orderId: id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt, status: 'Completed' } });
}

/** Loads `units` of order 1's single line on run 11, as RecordDeliveredDialog does. */
async function dispatch(units, extra = {}) {
  const source = await order();
  const moved = commitPartialDelivery([], source, [{ lineIndex: 0, units }]);
  const delivery = await run();
  return command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: source.revision,
    expectedDeliveryRevision: Number(delivery.revision), deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt },
    delivery: { status: 'On The Way', itemsManifest: [{ productId: 101, name: 'Sheets', orderedQty: 4, deliveredQty: units, backorderQty: 4 - units }] },
    ...extra });
}

async function cameBack() {
  const source = await order();
  const delivery = await run();
  return command('return_run', { orderId: 1, deliveryId: 11, expectedRevision: source.revision,
    expectedDeliveryRevision: Number(delivery.revision) });
}

describe('a refund after a replacement', () => {
  it('cannot put back on the shelf goods a replacement already swapped for another product', async () => {
    await complete();
    expect(await stock()).toBe(60);
    let source = await order();
    // 2 broken sheets come back and are thrown away; 2 balls go out instead.
    await command('replace', { orderId: 1, expectedRevision: source.revision, lineIndex: 0, quantity: 2,
      disposition: 'scrap', reason: 'damaged', replacementProductId: 102, replacementQuantity: 2 });
    expect([await stock(101), await stock(102)]).toEqual([60, 18]);

    source = await order();
    const refund = (deltas, items) => command('refund', { orderId: 1, expectedRevision: source.revision, deltas,
      order: { items, status: 'Cancelled', refundedAmount: 600, refundHistory: [{ id: 1, amount: 600, method: 'credit' }] } });
    // The customer holds 2 sheets, not 4: claiming 4 back is refused.
    const all4 = handleRefundStock([], { ...source, replacementHistory: [] }, [{ lineIndex: 0, units: 4, disposition: 'restock' }]);
    await expect(refund(all4.deltas, all4.items)).rejects.toThrow(/Only returned goods/);
    // The ledger applies the same cap, so the screen sends 2.
    const moved = handleRefundStock([], source, [{ lineIndex: 0, units: 4, disposition: 'restock' }]);
    expect(moved.deltas).toEqual([{ productId: 101, delta: 2 }]);
    await refund(moved.deltas, moved.items);
    expect(await stock(101)).toBe(62);
  });

  it('still takes back all of a line replaced with the same product', async () => {
    await complete();
    let source = await order();
    await command('replace', { orderId: 1, expectedRevision: source.revision, lineIndex: 0, quantity: 2,
      disposition: 'scrap', reason: 'damaged' });
    expect(await stock()).toBe(58);
    source = await order();
    const moved = handleRefundStock([], source, [{ lineIndex: 0, units: 4, disposition: 'restock' }]);
    expect(moved.deltas).toEqual([{ productId: 101, delta: 4 }]);
    await command('refund', { orderId: 1, expectedRevision: source.revision, deltas: moved.deltas,
      order: { items: moved.items, status: 'Cancelled', refundedAmount: 600, refundHistory: [{ id: 1, amount: 600, method: 'credit' }] } });
    expect(await stock()).toBe(62);
  });
});

describe('calling an order off, or putting it back', () => {
  it('is refused once its goods have been delivered to the customer', async () => {
    await signIn(db, 'delivery');
    await dispatch(4);
    await command('arrive', { orderId: 1, deliveryId: 11, expectedRevision: (await order()).revision,
      expectedDeliveryRevision: Number((await run()).revision), deltas: [], order: { status: 'Completed' }, delivery: { status: 'Delivered' } });
    expect(await stock()).toBe(60);
    await signIn(db, 'manager');
    const source = await order();
    const back = uncommitOrder([], source);
    for (const action of ['reopen', 'cancel']) {
      await expect(command(action, { orderId: 1, expectedRevision: source.revision, deltas: back.deltas,
        order: { items: back.items, status: action === 'reopen' ? 'Pending' : 'Cancelled', stockCommittedAt: null } }))
        .rejects.toThrow(/have been delivered/);
    }
    expect(await stock()).toBe(60);
  });
});

describe('a run that comes back undelivered', () => {
  it('puts what it carried back on the shelf and the run back to Ready To Go', async () => {
    await signIn(db, 'delivery');
    await dispatch(3, { followUp: { driver: 'Jun', dueOn: '' } });
    expect(await stock()).toBe(61);
    const followUp = await one(db, 'select id, status, size from public.deliveries where parent_delivery_id = 11');
    expect(followUp).toMatchObject({ status: 'Not Yet Delivered', size: '1 × Sheets' });

    const result = await cameBack();
    expect(await stock()).toBe(64);
    expect(await run()).toMatchObject({ status: 'Ready To Go', items_manifest: [] });
    // This run carries everything again, so the one for what it left behind is gone.
    expect(result.removedDeliveries).toEqual([followUp.id]);
    const after = await order();
    expect(after.items[0].committedUnits).toBe(0);
    expect(after.stockCommittedAt).toBeNull();
    const moves = await all(db, "select kind, quantity_change from public.stock_movements where order_id = 1 order by id");
    expect(moves.map((m) => [m.kind, m.quantity_change])).toEqual([['dispatch', -3], ['cancellation', 3]]);
    // And it can go out again.
    await dispatch(4);
    expect(await stock()).toBe(60);
  });

  it('cannot be moved back by hand, which would leave the goods off the shelf', async () => {
    await signIn(db, 'delivery');
    await dispatch(4);
    await expect(write('delivery', `update public.deliveries set status = 'Ready To Go' where id = 11`))
      .rejects.toThrow(/Came back undelivered/);
    expect(await stock()).toBe(60);
  });

  it('is for the roles that handle deliveries, and only once', async () => {
    await signIn(db, 'delivery');
    await dispatch(4);
    await signIn(db, 'production');
    await expect(cameBack()).rejects.toThrow(/active staff|bring a delivery back/);
    await signIn(db, 'sales');
    await cameBack();
    await expect(cameBack()).rejects.toThrow(/on the way can come back|changed/);
    expect(await stock()).toBe(64);
  });
});

describe('a run that goes out short', () => {
  it('raises the run for what was left behind in the same transaction, and takes nothing if that fails', async () => {
    await signIn(db, 'delivery');
    await expect(dispatch(1, { followUp: { driver: '', dueOn: '2020-01-01' } })).rejects.toThrow(/already passed/);
    expect(await stock()).toBe(64);
    expect((await run()).status).toBe('Ready To Go');
    expect(await all(db, 'select id from public.deliveries where parent_delivery_id = 11')).toEqual([]);

    const result = await dispatch(1, { followUp: { driver: '', dueOn: '' } });
    expect(result.followUp).toMatchObject({ parent_delivery_id: 11, order_id: 1, size: '3 × Sheets', product: 'Order #1 - First (backorder)' });
    expect(Number(result.followUp.amount)).toBe(0);
    expect(await stock()).toBe(63);
  });
});

describe('stock promised to an earlier order', () => {
  beforeEach(async () => {
    await signIn(db, null);
    await db.exec('update public.inventory set stock = 5 where id = 101');
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, created_at) values
      (2, 'Later', $1, 300, now())`, [JSON.stringify([line(2)])]);
    await signIn(db, 'sales');
  });

  it('is not taken by a later order marked done by staff', async () => {
    await expect(complete(2)).rejects.toThrow(/promised to orders written before it/);
    expect(await stock()).toBe(5);
  });

  it('leaves the earlier order free to go, and what is spare free to anyone', async () => {
    await complete(1);
    expect(await stock()).toBe(1);
    await signIn(db, null);
    await db.exec('update public.inventory set stock = 6 where id = 101');
    await signIn(db, 'sales');
    await complete(2);
    expect(await stock()).toBe(4);
  });

  it('can be given to a later order by a manager', async () => {
    await signIn(db, 'manager');
    await complete(2);
    expect(await stock()).toBe(3);
  });
});

describe('the total on an order', () => {
  it('moves with the lines while nothing has happened to the order', async () => {
    await write('manager', `update public.orders set items = $1, total_amount = 900 where id = 1`, [JSON.stringify([line(6)])]);
    expect((await order()).totalAmount).toBe(900);
  });

  it('moves only with a price correction once anything has', async () => {
    await complete();
    await expect(write('manager', 'update public.orders set total_amount = 1 where id = 1')).rejects.toThrow(/Fix the price/);
    await expect(write('manager', `update public.orders set total_amount = 500,
      price_adjustments = '[{"oldTotal": 999, "newTotal": 500}]' where id = 1`)).rejects.toThrow(/changed from and the total it changed to/);
    await write('manager', `update public.orders set total_amount = 500,
      price_adjustments = '[{"oldTotal": 600, "newTotal": 500, "changedBy": "Somebody else", "reason": "typo"}]' where id = 1`);
    const [entry] = (await order()).priceAdjustments;
    // Who made it is the database's to say, not the browser's.
    expect(entry).toMatchObject({ newTotal: 500, changedBy: 'manager person', reason: 'typo' });
    expect(entry.changedAt).toBeTruthy();
  });
});

describe('product codes', () => {
  it('allow one product per code in any capitalisation', async () => {
    await expect(write('manager', `insert into public.products (id, item_code, name) values (903, 'ss-100', 'Copy')`))
      .rejects.toThrow(/duplicate key|products_item_code_lower_key/);
  });

  it('cannot be changed by a direct write, on either half', async () => {
    await expect(write('manager', `update public.products set item_code = 'ZZ-1' where id = 901`)).rejects.toThrow(/code cannot be changed/);
    await expect(write('manager', `update public.inventory set sku = 'ZZ-1' where id = 101`)).rejects.toThrow(/code cannot be changed/);
    // Capitals only, as the product form writes the stock row's code back.
    await write('manager', `update public.inventory set sku = 'ss-100' where id = 101`);
  });
});

describe('removing and restoring products', () => {
  it('goes through remove_product, an administrator included', async () => {
    await write('admin', 'delete from public.inventory where id = 102');
    await write('admin', 'delete from public.products where id = 902');
    expect(await all(db, 'select id from public.products where id = 902')).toHaveLength(1);
    expect(await stock(102)).toBe(20);
  });

  it('archives and puts back on sale only by an administrator, through the functions', async () => {
    await expect(write('manager', `update public.products set status = 'Archived' where id = 902`)).rejects.toThrow(/administrator/);
    await expect(write('manager', `insert into public.products (id, item_code, name, status) values (904, 'NEW-1', 'New', 'Archived')`))
      .rejects.toThrow(/starts on sale/);
    await signIn(db, null);
    // A product with history: a finished order sold some.
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, status) values (5, 'x', $1, 1, 'Completed')`,
      [JSON.stringify([line(1, 102)])]);
    await signIn(db, 'admin');
    expect((await one(db, 'select public.remove_product(902, 0) as r')).r.outcome).toBe('archived');
    const revision = Number((await one(db, 'select revision from public.products where id = 902')).revision);
    await signIn(db, 'manager');
    await expect(db.query('select public.restore_product(902, $1)', [revision])).rejects.toThrow(/Only an administrator/);
    await signIn(db, 'admin');
    await db.query('select public.restore_product(902, $1)', [revision]);
    expect((await one(db, 'select status from public.products where id = 902')).status).toBe('Active');
  });
});

describe('finishing a batch', () => {
  it('refuses more than twice the pieces planned, until a manager changes the target', async () => {
    await signIn(db, null);
    await db.exec(`insert into public.raw_materials (id, sku, name, unit, stock) values (7001, 'RM-T', 'Block', 'block', 10);
      insert into public.raw_material_lots (raw_material_id, quantity, remaining, source) values (7001, 10, 10, 'Test');`);
    await signIn(db, 'production');
    const ws = (action, data) => rpc(db, 'workshop_command', action, data);
    const batch = await ws('start_batch', { product_id: 902, raw_material_id: 7001, material_qty: 2, output_qty: 10, assigned_staff_id: 14 });
    await ws('batch_status', { id: batch.id, status: 'In Progress' });
    await ws('batch_status', { id: batch.id, status: 'Quality Check', produced: 10, damaged: 0 });
    // The checker's count is held to the same line as the maker's.
    await expect(ws('complete_batch', { id: batch.id, produced: 1000000, damaged: 0, material_qty: 1 }))
      .rejects.toThrow(/more than twice the 10 planned/);
    expect(await stock(102)).toBe(20);
    // Above target but within reason is an ordinary good day.
    await signIn(db, 'manager');
    await ws('edit_batch', { id: batch.id, output_qty: 30, material_qty: 2, assigned_staff_id: 14 });
    await signIn(db, 'production');
    await ws('complete_batch', { id: batch.id, produced: 50, damaged: 0, material_qty: 2 });
    expect(await stock(102)).toBe(70);
  });
});

describe('deliveries and production staff', () => {
  it('cannot be written by a role that cannot read them', async () => {
    await expect(write('production', `insert into public.deliveries (id, product, location, order_id) values (40, 'Order #1 - First', 'x', 1)`))
      .rejects.toThrow(/row-level security/);
    expect((await write('production', `update public.deliveries set driver = 'me' where id = 11`)).rows).toHaveLength(0);
    await write('sales', `insert into public.deliveries (id, product, location, order_id) values (40, 'Order #1 - First', 'x', 1)`);
  });
});

describe('stored status values', () => {
  it('are the three order states and the five delivery stages, whoever writes them', async () => {
    await signIn(db, null);
    await expect(db.exec(`update public.orders set status = 'Shipped' where id = 1`)).rejects.toThrow(/orders_status_check/);
    await expect(db.exec(`update public.deliveries set status = 'Lost' where id = 11`)).rejects.toThrow(/deliveries_status_check/);
  });
});
