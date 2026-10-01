// Exact runbook balances, against disposable PGlite only. This is not hosted
// acceptance: JWTs are simulated and there is only one database connection.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { env } from 'node:process';
import { all, asApi, freshDatabase, one, readSql } from '../test/database';
import { commitOrder, commitPartialDelivery, handleRefundStock, reservedByProduct, uncommitOrder } from './stockLedger';

const label = env.QA_RUN_ID || 'QA-local-acceptance';
let db;
let caseName;
const record = (step, data) => {
  if (env.QA_EVIDENCE_FILE) appendFileSync(env.QA_EVIDENCE_FILE,
    JSON.stringify({ run: label, case: caseName, step, data }) + '\n');
};
beforeEach(async (context) => {
  caseName = context.task.name;
  db = await freshDatabase();
  const report = await all(db, readSql('integrity_check.sql'));
  record('integrity-before', report);
  expect(report.every((row) => Number(row.found) === 0)).toBe(true);
}, 60_000);
afterEach(async () => {
  if (!db) return;
  try {
    const report = await all(db, readSql('integrity_check.sql'));
    record('integrity-after', report);
    expect(report.every((row) => Number(row.found) === 0)).toBe(true);
    record('final-movements', await all(db, 'select * from public.stock_movements order by id'));
  } finally { await db.close(); db = null; }
});
const command = (family, action, data, key) => asApi(db, 'manager', () => rpcCommand(family, action, data, key));
async function rpcCommand(family, action, data, key = crypto.randomUUID()) {
  return (await one(db, `select public.${family}_command($1,$2,$3) as r`, [action, JSON.stringify(data), key])).r;
}
async function repeat(family, action, data) {
  const key = crypto.randomUUID();
  const first = await command(family, action, data, key);
  const before = await snapshot();
  expect(await command(family, action, data, key)).toEqual(first);
  expect(await snapshot()).toEqual(before);
  record(`${family}/${action}-replayed-once`, { key, data, result: first });
  return first;
}
async function snapshot() {
  const result = {};
  for (const table of ['inventory', 'raw_materials', 'raw_material_lots', 'orders', 'deliveries', 'production_batches', 'stock_movements', 'activity_log']) {
    result[table] = await all(db, `select * from public.${table} order by id`);
  }
  return result;
}
async function rejected(fn) {
  const before = await snapshot();
  await expect(fn()).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  record('rejection-no-business-or-history-change', true);
}
async function product(stock) {
  await db.query('insert into public.products(id,item_code,name,unit_price,pack_size) values(500,$1,$2,100,1)', [label + '-P', label + ' product']);
  await db.query("insert into public.inventory(id,sku,name,category,price,stock,pack_size) values(501,$1,$2,'QA',100,$3,1)", [label + '-P', label + ' product', stock]);
}
async function order(quantity, id = 601) {
  const items = [{ productId: 501, name: label + ' product', kind: 'catalog', quantity, stockUnits: quantity, unitPrice: 100, lineTotal: quantity * 100 }];
  await asApi(db, 'sales', () => db.query('insert into public.orders(id,customer_name,items,total_amount) values($1,$2,$3,$4)', [id, label + ' walk-in', JSON.stringify(items), quantity * 100]));
  return readOrder(id);
}
async function readOrder(id = 601) {
  const row = await one(db, 'select * from public.orders where id=$1', [id]);
  return { id: row.id, revision: Number(row.revision), items: row.items, status: row.status, stockCommittedAt: row.stock_committed_at,
    totalAmount: Number(row.total_amount), refundedAmount: Number(row.refunded_amount), refundHistory: row.refund_history };
}
async function balance(step, shelf, reserved, id = 601) {
  const stored = await readOrder(id);
  const stock = (await one(db, 'select stock from public.inventory where id=501')).stock;
  const held = reservedByProduct([stored]).get(501) || 0;
  record(step, { stock, reserved: held, free: stock - held, order: stored });
  expect([stock, held, stock - held]).toEqual([shelf, reserved, shelf - reserved]);
}
async function finish(id = 601) {
  const source = await readOrder(id);
  const moved = commitOrder([], source);
  return repeat('order', 'complete', { orderId: id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt, status: 'Completed' } });
}

it('FLOW-01: 20 -> 16 -> 17 -> 16; refund and replacement preserve the exact money', async () => {
  await product(20); await order(4); await balance('waiting', 20, 4);
  await finish(); await balance('finished', 16, 0);
  let source = await readOrder();
  const moved = handleRefundStock([], source, [{ lineIndex: 0, units: 1, disposition: 'restock' }]);
  await repeat('order', 'refund', { orderId: source.id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, refundedAmount: 100, status: source.status, refundHistory: [{ id: crypto.randomUUID(), amount: 100 }] } });
  await balance('refunded', 17, 0);
  source = await readOrder();
  expect(source.totalAmount - source.refundedAmount).toBe(300);
  await repeat('order', 'replace', { orderId: source.id, expectedRevision: source.revision, lineIndex: 0, quantity: 1, disposition: 'scrap', reason: 'damaged' });
  await balance('replacement', 16, 0);
  expect(await readOrder()).toMatchObject({ totalAmount: 400, refundedAmount: 100, status: 'Completed' });
  expect((await all(db, 'select quantity_change from public.stock_movements where inventory_id=501 order by id')).map((r) => r.quantity_change)).toEqual([20, -4, 1, -1]);
});

it('FLOW-02: dispatch 6 then 4, linked follow-up, shelf 20 -> 14 -> 10 and total 1000', async () => {
  await product(20); await order(10);
  await asApi(db, 'sales', () => db.query("insert into public.deliveries(id,product,location,status,order_id) values(701,$1,'QA address','Ready To Go',601)", ['Order #601 - ' + label]));
  for (const [deliveryId, quantity] of [[701, 6], [702, 4]]) {
    const source = await readOrder();
    // The ledger helper takes the cumulative manifest; the UI converts this
    // trip's quantity to that total before calling it (see App.jsx).
    const moved = commitPartialDelivery([], source, [{ lineIndex: 0, units: (source.items[0].committedUnits || 0) + quantity }]);
    await repeat('order', 'dispatch', { orderId: 601, deliveryId, expectedRevision: source.revision, expectedDeliveryRevision: 0,
      deltas: moved.deltas, order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt }, delivery: { status: 'On The Way' } });
    await balance('dispatch-' + deliveryId, deliveryId === 701 ? 14 : 10, deliveryId === 701 ? 4 : 0);
    if (deliveryId === 701) {
      // These non-stock writes are separate supported collection operations;
      // automatic follow-up creation and its retries still need the UI test.
      await asApi(db, 'sales', () => db.exec("update public.deliveries set status='Delivered' where id=701"));
      await asApi(db, 'sales', () => db.query("insert into public.deliveries(id,product,location,status,order_id,parent_delivery_id) values(702,$1,'QA address','Ready To Go',601,701)", ['Order #601 - ' + label]));
    }
  }
  const source = await readOrder();
  const delivery = await one(db, 'select revision from public.deliveries where id=702');
  await repeat('order', 'arrive', { orderId: 601, deliveryId: 702, expectedRevision: source.revision, expectedDeliveryRevision: Number(delivery.revision),
    deltas: [], order: { items: source.items, status: 'Completed' }, delivery: { status: 'Delivered' } });
  expect(await readOrder()).toMatchObject({ totalAmount: 1000, status: 'Completed' });
  expect((await one(db, 'select parent_delivery_id,order_id from public.deliveries where id=702'))).toEqual({ parent_delivery_id: 701, order_id: 601 });
});

it('FLOW-03: receive 8 usable, consume 3, make 5 good and 1 defect; claims do not add stock', async () => {
  await product(0);
  await asApi(db, 'manager', () => db.query('insert into public.suppliers(id,name) values(801,$1)', [label + ' supplier']));
  const material = await command('workshop', 'save_material', { sku: label + '-M', name: label + ' material', unit: 'sheet', low_stock_threshold: 0 });
  const purchase = await repeat('workshop', 'save_order', { supplier_id: 801, raw_material_id: material.id, quantity_ordered: 10, unit_price: 50 });
  expect(Number(purchase.total_cost)).toBe(500);
  expect((await one(db, 'select stock from public.raw_materials where id=$1', [material.id])).stock).toBe(0);
  const received = await repeat('workshop', 'receive_delivery', { id: purchase.id, arrived: 10, damaged: 2, reason: 'Broken edges/corners', reference: label });
  expect(received).toMatchObject({ quantity_usable: 8, claim_status: 'Needs review' });
  const batch = await command('workshop', 'start_batch', { product_id: 500, raw_material_id: material.id, material_qty: 3, output_qty: 6, assigned_staff_id: 14 });
  expect((await one(db, 'select stock from public.raw_materials where id=$1', [material.id])).stock).toBe(8);
  for (const status of ['In Progress', 'Quality Check']) await command('workshop', 'batch_status', { id: batch.id, status });
  await repeat('workshop', 'complete_batch', { id: batch.id, produced: 6, damaged: 1, material_qty: 3, reason: 'Broke during hotwire/cutting' });
  const beforeClaim = await all(db, 'select stock from public.raw_materials');
  await repeat('workshop', 'review_claim', { id: purchase.id, reason: label + ' claim resolved without stock adjustment' });
  expect(await all(db, 'select stock from public.raw_materials')).toEqual(beforeClaim);
  const stocks = await one(db, 'select (select stock from public.raw_materials where id=$1) as material,(select sum(remaining) from public.raw_material_lots where raw_material_id=$1) as lots,(select stock from public.inventory where id=501) as product', [material.id]);
  expect([Number(stocks.material), Number(stocks.lots), stocks.product]).toEqual([5, 5, 5]);
  expect(Number((await one(db, 'select sum(damaged_quantity) as n from public.production_defect_logs')).n)).toBe(1);
  expect(Number((await one(db, 'select sum(quantity) as n from public.production_material_usage')).n)).toBe(3);
  record('completed', { ...stocks, good: 5, defects: 1, yieldPercent: (100 * 5 / 6).toFixed(2) });
});

it('FLOW-04: product and material 10 -> 8 -> 10 -> rejected unchanged -> 9', async () => {
  await product(10);
  const material = await command('workshop', 'save_material', { sku: label + '-M', name: label + ' material', unit: 'sheet', low_stock_threshold: 0 });
  await command('stock', 'correct_count', { target: 'material', id: material.id, quantity: 10, expectedStock: 0, reason: 'found' });
  for (const [target, id, table, column] of [['product', 501, 'inventory', 'inventory_id'], ['material', material.id, 'raw_materials', 'raw_material_id']]) {
    const check = async (n) => {
      expect((await one(db, `select stock from public.${table} where id=$1`, [id])).stock).toBe(n);
      if (target === 'material') expect(Number((await one(db, 'select sum(remaining) as n from public.raw_material_lots where raw_material_id=$1', [id])).n)).toBe(n);
      record(target + '-balance', n);
    };
    await repeat('stock', 'record_damage', { target, id, quantity: 2, reason: 'broken' }); await check(8);
    const damage = await one(db, `select id from public.stock_movements where ${column}=$1 and kind='damage'`, [id]);
    await repeat('stock', 'undo_damage', { movementId: damage.id }); await check(10);
    await rejected(() => command('stock', 'undo_damage', { movementId: damage.id })); await check(10);
    await repeat('stock', 'correct_count', { target, id, quantity: 9, expectedStock: 10, reason: 'recount' }); await check(9);
  }
});

it('FLOW-05: cancellation releases reservation; finish/reopen/finish gives 7 -> 10 -> 7', async () => {
  await product(10); let source = await order(3);
  await balance('waiting', 10, 3);
  await repeat('order', 'cancel', { orderId: 601, expectedRevision: source.revision, deltas: [], order: { items: source.items, status: 'Cancelled', stockCommittedAt: null } });
  await balance('cancelled', 10, 0);
  await order(3, 602); await finish(602); await balance('finished', 7, 0, 602);
  source = await readOrder(602); const moved = uncommitOrder([], source);
  await repeat('order', 'reopen', { orderId: 602, expectedRevision: source.revision, deltas: moved.deltas, order: { items: moved.items, stockCommittedAt: null, status: 'Pending' } });
  await balance('reopened', 10, 3, 602); await finish(602); await balance('refinished', 7, 0, 602);
});

it('FLOW-06: loyalty 2 vs 3 finished orders, discount 20, total 180, old history retained', async () => {
  await asApi(db, 'manager', () => db.exec('update public.loyalty_rules set enabled=true,reward_after_orders=3,reward_percent=10 where id=1'));
  await asApi(db, 'sales', () => db.query('insert into public.customers(id,name) values(901,$1)', [label + ' customer']));
  const items = [{ kind: 'custom', name: label + ' custom', quantity: 2, unitPrice: 100, lineTotal: 200 }];
  for (const id of [910, 911]) await db.query("insert into public.orders(id,customer_id,customer_name,items,total_amount,status,created_at) values($1,901,$2,$3,200,'Completed',now()-interval '200 days')", [id, label + ' customer', JSON.stringify(items)]);
  const discount = () => asApi(db, 'sales', () => db.query("insert into public.orders(id,customer_id,customer_name,items,total_amount,discount_amount,promotion) values(913,901,$1,$2,180,20,'{\"kind\":\"loyalty\",\"percent\":10}')", [label + ' customer', JSON.stringify(items)]));
  await rejected(discount);
  await db.query("insert into public.orders(id,customer_id,customer_name,items,total_amount,status) values(912,901,$1,$2,200,'Completed')", [label + ' customer', JSON.stringify(items)]);
  await discount();
  const saved = await one(db, 'select * from public.orders where id=913');
  await asApi(db, 'manager', () => db.exec('update public.loyalty_rules set enabled=false where id=1'));
  expect(await one(db, 'select * from public.orders where id=913')).toEqual(saved);
  const stats = await asApi(db, 'sales', () => one(db, "select order_count,completed_count,open_count,spent from public.customer_order_stats where customer_key='id:901'"));
  expect(stats).toEqual({ order_count: 4, completed_count: 3, open_count: 1, spent: '780' });
  record('reward-disabled-old-order-retained', { total: saved.total_amount, discount: saved.discount_amount, stats });
});
