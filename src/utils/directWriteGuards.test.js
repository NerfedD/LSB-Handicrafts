// What a browser may write to orders and deliveries for itself, and how much
// of a refund is money handed back -- against the real schema in PGlite (see
// src/test/database.js). The commands themselves are covered in
// orderDatabase.test.js; this is the way AROUND them, which has to be shut.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, rpc, signIn } from '../test/database';
import { commitOrder, commitPartialDelivery, handleRefundStock, uncommitOrder } from './stockLedger';

let db;
const line = (quantity = 4, extra = {}) =>
  ({ productId: 101, name: 'Sheets', quantity, stockUnits: quantity, unitPrice: 150, kind: 'catalog', ...extra });

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await signIn(db, null);
  await db.exec(`
    delete from public.order_payments; delete from public.stock_movements; delete from public.deliveries;
    delete from public.orders; delete from public.inventory; delete from private.order_requests;
    insert into public.inventory (id, sku, name, category, stock) values (101, 'SS-100', 'Sheets', 'Test', 64);`);
  await db.query(`insert into public.orders (id, customer_name, items, total_amount) values (1, 'Test', $1, 600)`,
    [JSON.stringify([line()])]);
  await db.exec(`insert into public.deliveries (id, product, location, status, order_id) values
    (11, 'Order #1 - Test', 'Davao', 'Not Yet Delivered', 1), (12, 'Walk-in pick-up', 'Davao', 'Not Yet Delivered', null)`);
  await signIn(db, 'admin');
});

async function order(id = 1) {
  const row = await one(db, 'select * from public.orders where id = $1', [id]);
  return { id: row.id, revision: Number(row.revision), items: row.items, status: row.status,
    stockCommittedAt: row.stock_committed_at, refundedAmount: Number(row.refunded_amount),
    refundHistory: row.refund_history, totalAmount: Number(row.total_amount) };
}
const stock = async () => (await one(db, 'select stock from public.inventory where id = 101')).stock;
const command = (action, data) => rpc(db, 'order_command', action, data);
const write = (who, sql, params = []) => asApi(db, who, () => db.query(sql, params));
const delivery = (id = 11) => one(db, 'select status, revision, items_manifest from public.deliveries where id = $1', [id]);

async function complete() {
  const source = await order();
  const moved = commitOrder([], source);
  await command('complete', { orderId: 1, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt, status: 'Completed' } });
}

async function dispatch(units = 4) {
  const source = await order();
  const moved = commitPartialDelivery([], source, [{ lineIndex: 0, units }]);
  const run = await delivery();
  await command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: source.revision,
    expectedDeliveryRevision: Number(run.revision), deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt },
    delivery: { status: 'On The Way', itemsManifest: [{ productId: 101, name: 'Sheets', orderedQty: 4, deliveredQty: units, backorderQty: 4 - units }] } });
}

async function refund(amount, { method = 'cash', units = 0 } = {}) {
  const source = await order();
  const moved = handleRefundStock([], source, units ? [{ lineIndex: 0, units, disposition: 'scrap' }] : []);
  const total = source.refundedAmount + amount;
  await command('refund', { orderId: 1, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, refundedAmount: total, status: total >= source.totalAmount ? 'Cancelled' : source.status,
      refundHistory: [...source.refundHistory, { id: crypto.randomUUID(), amount, method }] } });
  return (await order()).refundHistory.at(-1);
}

const pay = (amount) => db.query(
  `select public.record_payment(array[1]::bigint[], $1, 'cash', null, (now() at time zone 'Asia/Manila')::date, null, gen_random_uuid())`, [amount]);

describe('orders written straight to the table', () => {
  it('takes a new waiting order from any staff member, as the order form writes it', async () => {
    await write('sales', `insert into public.orders (id, customer_name, items, total_amount, status, stock_committed_at,
        backorder_status, refund_history, price_adjustments, refunded_amount)
      values (2, 'Walk-in', $1, 300, 'Pending', null, 'none', '[]', '[]', 0)`, [JSON.stringify([line(2)])]);
    expect((await order(2)).status).toBe('Pending');
  });

  it.each([
    ['already finished', `status`, `'Completed'`, /starts as waiting/],
    ['already called off', `status`, `'Cancelled'`, /starts as waiting/],
    ['stamped as sent', `stock_committed_at`, `now()`, /cannot say goods have already left/],
    ['carrying a refund', `refunded_amount`, `100`, /cannot carry refunds/],
    ['carrying refund history', `refund_history`, `'[{"amount": 100}]'`, /cannot carry refunds/],
    ['carrying a replacement', `replacement_history`, `'[{"quantity": 1}]'`, /cannot carry refunds/],
  ])('refuses a new order %s', async (_, column, value, message) => {
    await expect(write('sales', `insert into public.orders (id, customer_name, items, total_amount, ${column})
      values (2, 'Ghost', $1, 600, ${value})`, [JSON.stringify([line()])])).rejects.toThrow(message);
    expect(await all(db, 'select id from public.orders where id = 2')).toEqual([]);
  });

  it('refuses a new order whose lines say goods have left, so nothing can later be "put back"', async () => {
    for (const counter of ['committedUnits', 'voidedUnits']) {
      await expect(write('sales', `insert into public.orders (id, customer_name, items, total_amount) values (2, 'Ghost', $1, 600)`,
        [JSON.stringify([line(4, { [counter]: 4 })])])).rejects.toThrow(/cannot say goods have already left/);
    }
  });

  it.each(['sales', 'delivery', 'production', 'manager', 'admin'])('refuses %s finishing or calling off an order by editing it', async (who) => {
    for (const status of ['Completed', 'Cancelled', 'Shipped']) {
      await expect(write(who, `update public.orders set status = $1 where id = 1`, [status])).rejects.toThrow(/changes status when/);
    }
    expect(await stock()).toBe(64);
    expect((await order()).status).toBe('Pending');
  });

  it('refuses counters typed into the lines, for staff and managers alike', async () => {
    for (const who of ['delivery', 'manager']) {
      await expect(write(who, 'update public.orders set items = $1 where id = 1',
        [JSON.stringify([line(4, { committedUnits: 4 })])])).rejects.toThrow(/cannot be edited to say goods have left/);
      await expect(write(who, 'update public.orders set stock_committed_at = now() where id = 1'))
        .rejects.toThrow(/recorded when it is marked done or sent out/);
    }
    // So a cancel has nothing to put back.
    await signIn(db, 'manager');
    const source = await order();
    const back = uncommitOrder([], source);
    await command('cancel', { orderId: 1, expectedRevision: source.revision, deltas: back.deltas,
      order: { items: back.items, status: 'Cancelled', stockCommittedAt: null } });
    expect(await stock()).toBe(64);
  });

  it('lets a manager rewrite an order nothing has happened to, and correct its price', async () => {
    await write('manager', `update public.orders set items = $1, total_amount = 900, customer_name = 'Renamed' where id = 1`,
      [JSON.stringify([line(6)])]);
    await write('manager', `update public.orders set total_amount = 850,
      price_adjustments = '[{"oldTotal": 900, "newTotal": 850, "reason": "typo"}]' where id = 1`);
    expect((await order()).totalAmount).toBe(850);
  });

  it('lets a price correction be added but never changed or removed', async () => {
    await write('manager', `update public.orders set total_amount = 550, price_adjustments = '[{"oldTotal": 600, "newTotal": 550}]' where id = 1`);
    await expect(write('manager', `update public.orders set price_adjustments = '[]' where id = 1`)).rejects.toThrow(/can only be added to/);
    await expect(write('manager', `update public.orders set price_adjustments = '[{"oldTotal": 1, "newTotal": 550}]' where id = 1`))
      .rejects.toThrow(/can only be added to/);
    await write('manager', `update public.orders set total_amount = 500,
      price_adjustments = '[{"oldTotal": 600, "newTotal": 550}, {"oldTotal": 550, "newTotal": 500}]' where id = 1`);
  });

  it('keeps the lines of an order as they are once goods have moved, but still takes a price correction', async () => {
    await complete();
    const saved = await order();
    await expect(write('manager', 'update public.orders set items = $1 where id = 1', [JSON.stringify([line(9)])]))
      .rejects.toThrow(/lines are the record of what went/);
    await expect(write('manager', 'update public.orders set items = $1 where id = 1',
      [JSON.stringify(saved.items.map((item) => ({ ...item, committedUnits: 0 })))])).rejects.toThrow(/lines are the record of what went/);
    // The whole row written back unchanged apart from the price, as "Fix the price" does.
    await write('manager', `update public.orders set items = $1, status = 'Completed', stock_committed_at = $2, total_amount = 500,
      price_adjustments = '[{"oldTotal": 600, "newTotal": 500}]' where id = 1`, [JSON.stringify(saved.items), saved.stockCommittedAt]);
    expect(await stock()).toBe(60);
  });

  it('refuses refund and replacement records written by hand, a manager included', async () => {
    for (const change of [`refunded_amount = 999999`, `refund_history = '[{"amount": 5}]'`, `replacement_history = '[{"quantity": 1}]'`]) {
      await expect(write('manager', `update public.orders set ${change} where id = 1`)).rejects.toThrow(/recorded with "Give money back"/);
    }
  });
});

describe('deliveries written straight to the table', () => {
  it('raises a delivery unsent, and nowhere else', async () => {
    await write('sales', `insert into public.deliveries (id, product, location, status, order_id) values (20, 'Order #1 - Test', 'x', 'Not Yet Delivered', 1)`);
    for (const status of ['Ready To Go', 'On The Way', 'Delivered']) {
      await expect(write('sales', `insert into public.deliveries (id, product, location, status, order_id) values (21, 'Order #1 - Test', 'x', $1, 1)`, [status]))
        .rejects.toThrow(/starts as not yet sent/);
    }
    await expect(write('sales', `insert into public.deliveries (id, product, location, items_manifest) values (21, 'x', 'x', '[{"deliveredQty": 9}]')`))
      .rejects.toThrow(/recorded when it is sent out/);
  });

  it('moves one stage at a time, forward or back', async () => {
    await expect(write('delivery', `update public.deliveries set status = 'Delivered' where id = 11`)).rejects.toThrow(/one stage at a time/);
    await expect(write('delivery', `update public.deliveries set status = 'Ready To Go' where id = 11`)).rejects.toThrow(/one stage at a time/);
    await expect(write('delivery', `update public.deliveries set status = 'Lost' where id = 11`)).rejects.toThrow(/not one of the delivery stages/);
    await write('delivery', `update public.deliveries set status = 'Being Made' where id = 11`);
    await write('delivery', `update public.deliveries set status = 'Ready To Go' where id = 11`);
    await write('delivery', `update public.deliveries set status = 'Being Made' where id = 11`);
    expect((await delivery()).status).toBe('Being Made');
  });

  it('sends an order\'s delivery out only through dispatch, which is what takes the goods off the shelf', async () => {
    for (const status of ['Being Made', 'Ready To Go']) await write('delivery', 'update public.deliveries set status = $1 where id = 11', [status]);
    await expect(write('delivery', `update public.deliveries set status = 'On The Way' where id = 11`)).rejects.toThrow(/Use "Send out"/);
    expect(await stock()).toBe(64);

    await signIn(db, 'delivery');
    await dispatch(3);
    expect(await stock()).toBe(61);
    expect((await delivery()).status).toBe('On The Way');
    // A short run arrives by a plain move (the order still owes goods), and can be stepped back.
    await write('delivery', `update public.deliveries set status = 'Delivered' where id = 11`);
    await write('delivery', `update public.deliveries set status = 'On The Way' where id = 11`);
    await expect(write('sales', `update public.deliveries set items_manifest = '[]' where id = 11`)).rejects.toThrow(/cannot be edited afterwards/);
    expect(await stock()).toBe(61);
  });

  it('lets a delivery raised by hand, with no order behind it, move all the way', async () => {
    for (const status of ['Being Made', 'Ready To Go', 'On The Way', 'Delivered']) {
      await write('delivery', 'update public.deliveries set status = $1 where id = 12', [status]);
    }
    expect((await delivery(12)).status).toBe('Delivered');
  });

  it('lets the delivery of an order already finished go out as a plain move, and refuses one called off', async () => {
    for (const status of ['Being Made', 'Ready To Go']) await write('delivery', 'update public.deliveries set status = $1 where id = 11', [status]);
    await signIn(db, 'manager');
    await complete();
    expect(await stock()).toBe(60);
    // Its goods left the shelf when it was marked done; there is nothing more to count.
    await write('delivery', `update public.deliveries set status = 'On The Way' where id = 11`);
    await write('delivery', `update public.deliveries set status = 'Ready To Go' where id = 11`);
    expect(await stock()).toBe(60);

    await signIn(db, 'manager');
    const source = await order();
    const back = uncommitOrder([], source);
    await command('reopen', { orderId: 1, expectedRevision: source.revision, deltas: back.deltas,
      order: { items: back.items, status: 'Pending', stockCommittedAt: null } });
    const waiting = await order();
    await command('cancel', { orderId: 1, expectedRevision: waiting.revision, deltas: [],
      order: { items: waiting.items, status: 'Cancelled', stockCommittedAt: null } });
    // Cancelling took the unsent run off the board; one written back by hand cannot go out either.
    await write('manager', `insert into public.deliveries (id, product, location, order_id) values (30, 'Order #1 - Test', 'x', 1)`);
    for (const status of ['Being Made', 'Ready To Go']) await write('delivery', 'update public.deliveries set status = $1 where id = 30', [status]);
    await expect(write('delivery', `update public.deliveries set status = 'On The Way' where id = 30`)).rejects.toThrow(/called off/);
  });

  it('holds a delivery linked only by its text to the same rule, and to its order', async () => {
    await signIn(db, null);
    await db.exec(`update public.deliveries set order_id = null, status = 'Ready To Go' where id = 11`);
    await expect(write('delivery', `update public.deliveries set status = 'On The Way' where id = 11`)).rejects.toThrow(/Use "Send out"/);
    await expect(write('delivery', `update public.deliveries set product = 'Something else' where id = 11`)).rejects.toThrow(/stays with that order/);
    // The customer's name after the prefix can still be corrected, as editing the order does.
    await write('manager', `update public.deliveries set product = 'Order #1 - Renamed' where id = 11`);
  });

  it('still takes the ordinary edits: driver, address and promised date', async () => {
    await write('delivery', `update public.deliveries set driver = 'Ramon', location = 'New address', due_on = current_date + 3 where id = 11`);
    expect((await one(db, 'select driver from public.deliveries where id = 11')).driver).toBe('Ramon');
  });
});

describe('how much of a refund is money handed back', () => {
  beforeEach(async () => { await signIn(db, 'manager'); await complete(); });

  it('hands nothing back on an order nobody has paid for: it comes off what they owe', async () => {
    expect(await refund(150, { units: 1 })).toMatchObject({ amount: 150, handedBack: 0, offBalance: 150 });
    // record_payment has always charged total less refunded: 450 is still owed, and no more can be taken.
    await expect(pay(451)).rejects.toThrow(/more than is owed/);
    await pay(450);
  });

  it('hands the whole amount back when the order was paid in full', async () => {
    await pay(600);
    expect(await refund(150, { units: 1 })).toMatchObject({ handedBack: 150, offBalance: 0 });
    expect(await refund(450, { units: 3 })).toMatchObject({ handedBack: 450, offBalance: 0 });
    expect((await order()).status).toBe('Cancelled');
  });

  it('hands back only what was paid beyond what the order still comes to', async () => {
    await pay(450);
    // 600 less 300 leaves 300 to pay for; 450 is in, so 150 goes back and 150 comes off the bill.
    expect(await refund(300, { units: 2 })).toMatchObject({ handedBack: 150, offBalance: 150 });
    // Another 150 back leaves 150 to pay for; 450 in, 150 already handed back.
    expect(await refund(150, { units: 1 })).toMatchObject({ handedBack: 150, offBalance: 0 });
    const history = (await order()).refundHistory;
    const handed = history.reduce((sum, entry) => sum + entry.handedBack, 0);
    expect(handed).toBe(300);
    expect(handed).toBeLessThanOrEqual(450);
  });

  it('never hands back more than was received, however the refund is described', async () => {
    await pay(100);
    expect(await refund(600, { units: 4 })).toMatchObject({ handedBack: 100, offBalance: 500 });
  });

  it('hands nothing back when the customer leaves it on their account', async () => {
    await pay(600);
    expect(await refund(150, { units: 1, method: 'credit' })).toMatchObject({ handedBack: 0, offBalance: 150 });
  });

  it('ignores what the browser says was handed back', async () => {
    const source = await order();
    await command('refund', { orderId: 1, expectedRevision: source.revision, deltas: [],
      order: { items: source.items, refundedAmount: 100, refundHistory: [{ id: 1, amount: 100, method: 'cash', handedBack: 100, offBalance: 0 }] } });
    expect((await order()).refundHistory[0]).toMatchObject({ handedBack: 0, offBalance: 100 });
  });

  it('counts a refund recorded before this rule as money already handed back', async () => {
    // Written with the stamp switched off, which is what a row from before it looks like.
    await signIn(db, null);
    await db.exec(`alter table public.orders disable trigger orders_stamp_refund_money;
      update public.orders set refunded_amount = 100, refund_history = '[{"amount": 100, "method": "cash"}]' where id = 1;
      alter table public.orders enable trigger orders_stamp_refund_money;`);
    await signIn(db, 'manager');
    await pay(500);
    // 500 in, 100 already out, 350 still to pay for after this one: 50 can go back.
    expect(await refund(150, { units: 1 })).toMatchObject({ handedBack: 50, offBalance: 100 });
  });

  it('keeps a payment on record once money has been handed back against it', async () => {
    await pay(600);
    const payment = await one(db, 'select id from public.order_payments where order_id = 1');
    await refund(150, { units: 1 });
    await expect(db.query('select public.remove_payment($1)', [payment.id])).rejects.toThrow(/already been handed back against this payment/);
    expect(await all(db, 'select id from public.order_payments where order_id = 1')).toHaveLength(1);
  });

  it('still lets a mistyped payment be removed when no money has gone back', async () => {
    await pay(600);
    const payment = await one(db, 'select id from public.order_payments where order_id = 1');
    await refund(150, { units: 1, method: 'credit' });
    await db.query('select public.remove_payment($1)', [payment.id]);
    expect(await all(db, 'select id from public.order_payments where order_id = 1')).toEqual([]);
  });
});
