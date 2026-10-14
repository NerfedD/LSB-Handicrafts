// Corrections by role: stepping a batch back, cancelling and changing it,
// deleting one entered by mistake, re-opening a finished one, and the same
// way back for supplier orders, recipes and suppliers -- against the real
// schema in PGlite (see src/test/database.js).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, readSql, rpc } from '../test/database';

let db;
let next = 7000;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });

const as = (who, action, data, key) => asApi(db, who, () => rpc(db, 'workshop_command', action, data, key));
const refused = (promise, message) => expect(promise).rejects.toThrow(message);

const batchRow = (id) => one(db, 'select * from public.production_batches where id = $1', [id]);
const shelf = async (id) => (await one(db, 'select stock from public.inventory where id = $1', [id])).stock;
const materialStock = async (id) => (await one(db, 'select stock from public.raw_materials where id = $1', [id])).stock;
const lotsLeft = async (id) => Number((await one(db,
  'select coalesce(sum(remaining), 0) as n from public.raw_material_lots where raw_material_id = $1', [id])).n);

/** A product with its stock row, and a material with `stock` sheets in one lot. */
async function workshop({ stock = 20, onShelf = 0 } = {}) {
  const productId = uid();
  const inventoryId = productId + 100000;
  const code = `FIX-${productId}`;
  await db.query('insert into public.products (id, item_code, name, unit_price, pack_size) values ($1, $2, $3, 100, 1)',
    [productId, code, `Product ${productId}`]);
  await db.query(`insert into public.inventory (id, sku, name, category, price, stock, pack_size) values ($1, $2, $3, 'QA', 100, $4, 1)`,
    [inventoryId, code, `Product ${productId}`, onShelf]);
  const materialId = uid();
  await db.query(`insert into public.raw_materials (id, sku, name, unit, stock) values ($1, $2, $3, 'sheet', 0)`,
    [materialId, `RM-${materialId}`, `Material ${materialId}`]);
  if (stock > 0) {
    await db.query(`insert into public.raw_material_lots (raw_material_id, quantity, remaining, source) values ($1, $2, $2, 'Test')`,
      [materialId, stock]);
    await db.query('update public.raw_materials set stock = $2 where id = $1', [materialId, stock]);
  }
  return { productId, inventoryId, materialId };
}

const start = ({ productId, materialId }, materialQty = 5, who = 'production') =>
  as(who, 'start_batch', { product_id: productId, raw_material_id: materialId, material_qty: materialQty, output_qty: 10, assigned_staff_id: 14 });

async function finished(setup, { produced = 6, damaged = 1, materialQty = 3 } = {}) {
  const batch = await start(setup, materialQty);
  for (const status of ['In Progress', 'Quality Check']) await as('production', 'batch_status', { id: batch.id, status });
  await as('production', 'complete_batch', { id: batch.id, produced, damaged, material_qty: materialQty,
    reason: damaged ? 'Broke during hotwire/cutting' : undefined });
  return batch;
}

describe('stepping a batch back', () => {
  it('lets production staff undo a step pressed by mistake, one stage at a time', async () => {
    const batch = await start(await workshop());
    await as('production', 'batch_status', { id: batch.id, status: 'In Progress' });
    await as('production', 'batch_status', { id: batch.id, status: 'Quality Check' });

    expect(await as('production', 'batch_step_back', { id: batch.id })).toMatchObject({ status: 'In Progress' });
    const back = await as('production', 'batch_step_back', { id: batch.id });
    expect(back).toMatchObject({ status: 'Queued', started_at: null });
    await refused(as('production', 'batch_step_back', { id: batch.id }), 'can go back a step');
  });

  it('is not open to sales or delivery staff', async () => {
    const batch = await start(await workshop());
    await as('production', 'batch_status', { id: batch.id, status: 'In Progress' });
    await refused(as('sales', 'batch_step_back', { id: batch.id }), 'Only production staff');
  });
});

describe('cancelling a batch', () => {
  it('lets production staff cancel a planned batch, with a reason', async () => {
    const batch = await start(await workshop());
    await refused(as('production', 'cancel_batch', { id: batch.id }), 'Write why');
    expect(await as('production', 'cancel_batch', { id: batch.id, reason: 'Wrong product' })).toMatchObject({ status: 'Cancelled' });
  });

  it('leaves a batch already in production to a manager, and frees its material', async () => {
    const setup = await workshop({ stock: 10 });
    const batch = await start(setup, 8);
    await as('production', 'batch_status', { id: batch.id, status: 'In Progress' });
    await refused(as('production', 'cancel_batch', { id: batch.id, reason: 'Oops' }), 'manager or administrator');
    // 8 of 10 are set aside, so a second batch of 5 does not fit until it is cancelled.
    await refused(start(setup, 5), 'free');
    await as('manager', 'cancel_batch', { id: batch.id, reason: 'Customer called it off' });
    expect(await materialStock(setup.materialId)).toBe(10);
    await expect(start(setup, 5)).resolves.toMatchObject({ status: 'Queued' });
  });

  it('refuses a finished batch, which is re-opened instead', async () => {
    const batch = await finished(await workshop());
    await refused(as('admin', 'cancel_batch', { id: batch.id, reason: 'Late' }), 'unfinished batch');
  });
});

describe('changing a batch', () => {
  it('corrects the counts, the worker, the order and the notes for a manager', async () => {
    const setup = await workshop({ stock: 10 });
    const batch = await start(setup, 4);
    await refused(as('production', 'edit_batch', { id: batch.id, output_qty: 12, material_qty: 4, assigned_staff_id: 14 }), 'manager or administrator');
    const changed = await as('manager', 'edit_batch',
      { id: batch.id, output_qty: 12, material_qty: 6, assigned_staff_id: 12, order_id: '', notes: '  Use the denser sheets  ' });
    expect(changed).toMatchObject({ target_output_qty: 12, raw_material_used_qty: 6, assigned_staff_id: 12, order_id: null, notes: 'Use the denser sheets' });
  });

  it('refuses more material than is free, and a worker who cannot make batches', async () => {
    const setup = await workshop({ stock: 10 });
    const other = await start(setup, 7);
    const batch = await start(setup, 3);
    await refused(as('manager', 'edit_batch', { id: batch.id, output_qty: 10, material_qty: 4, assigned_staff_id: 14 }), 'Only 3 sheet');
    await refused(as('manager', 'edit_batch', { id: batch.id, output_qty: 10, material_qty: 3, assigned_staff_id: 13 }), 'production worker');
    expect((await batchRow(other.id)).raw_material_used_qty).toBe(7);
  });
});

describe('deleting a batch entered by mistake', () => {
  it('is for an administrator, and only for a batch that never moved stock', async () => {
    const setup = await workshop();
    const planned = await start(setup);
    await refused(as('manager', 'delete_batch', { id: planned.id, reason: 'Duplicate' }), 'Only an administrator');
    expect(await as('admin', 'delete_batch', { id: planned.id, reason: 'Duplicate' })).toMatchObject({ deleted: true });
    expect(await batchRow(planned.id)).toBeUndefined();

    const cancelled = await start(setup);
    await as('production', 'cancel_batch', { id: cancelled.id, reason: 'Wrong size' });
    await expect(as('admin', 'delete_batch', { id: cancelled.id, reason: 'Clean up' })).resolves.toMatchObject({ deleted: true });

    const done = await finished(setup);
    await refused(as('admin', 'delete_batch', { id: done.id, reason: 'Wrong' }), 'never moved stock');
  });

  it('keeps the deletion in the activity log with its reason', async () => {
    const batch = await start(await workshop());
    await as('admin', 'delete_batch', { id: batch.id, reason: 'Entered twice' });
    const log = await one(db, 'select description from public.activity_log where subject = $1 order by at desc, id desc limit 1', [batch.batch_code]);
    expect(log.description).toMatch(/deleted .* Reason: Entered twice/);
  });
});

describe('re-opening a finished batch', () => {
  it('takes the good pieces back off the shelf and returns the material to its lots', async () => {
    const setup = await workshop({ stock: 20 });
    const batch = await finished(setup, { produced: 6, damaged: 1, materialQty: 3 });
    expect([await shelf(setup.inventoryId), await materialStock(setup.materialId)]).toEqual([5, 17]);

    await refused(as('manager', 'reopen_batch', { id: batch.id, reason: 'Counted wrong' }), 'Only an administrator');
    const reopened = await as('admin', 'reopen_batch', { id: batch.id, reason: 'Counted wrong' });
    expect(reopened).toMatchObject({ status: 'Quality Check', good_output_qty: 0, damaged_qty: 0, completed_at: null });
    expect([await shelf(setup.inventoryId), await materialStock(setup.materialId), await lotsLeft(setup.materialId)]).toEqual([0, 20, 20]);
    expect(await all(db, 'select batch_id from public.production_defect_logs where batch_id = $1', [batch.id])).toEqual([]);
    expect(await all(db, 'select batch_id from public.production_material_usage where batch_id = $1', [batch.id])).toEqual([]);
    const undone = await all(db, `select quantity_change, reason from public.stock_movements
      where batch_id = $1 and kind = 'production_undone' order by inventory_id nulls last`, [batch.id]);
    expect(undone).toEqual([{ quantity_change: -5, reason: 'Counted wrong' }, { quantity_change: 3, reason: 'Counted wrong' }]);

    // Finished again with the right counts, from the same quality check.
    await as('production', 'complete_batch', { id: batch.id, produced: 4, damaged: 0, material_qty: 2 });
    expect([await shelf(setup.inventoryId), await materialStock(setup.materialId), await lotsLeft(setup.materialId)]).toEqual([4, 18, 18]);
  });

  it('refuses when waiting orders already hold those pieces, and changes nothing', async () => {
    const setup = await workshop({ stock: 20 });
    const batch = await finished(setup, { produced: 5, damaged: 0, materialQty: 3 });
    const items = [{ productId: setup.inventoryId, name: 'Held', kind: 'catalog', quantity: 4, stockUnits: 4, unitPrice: 100, lineTotal: 400 }];
    await db.query('insert into public.orders (id, customer_name, items, total_amount) values ($1, $2, $3, 400)',
      [uid(), 'Waiting customer', JSON.stringify(items)]);

    await refused(as('admin', 'reopen_batch', { id: batch.id, reason: 'Counted wrong' }), 'set aside for waiting orders');
    expect([await shelf(setup.inventoryId), (await batchRow(batch.id)).status]).toEqual([5, 'Completed']);
  });

  it('replays a retried request instead of reversing the stock twice', async () => {
    const setup = await workshop({ stock: 20 });
    const batch = await finished(setup, { produced: 6, damaged: 0, materialQty: 3 });
    const key = crypto.randomUUID();
    const first = await as('admin', 'reopen_batch', { id: batch.id, reason: 'Retry' }, key);
    expect(await as('admin', 'reopen_batch', { id: batch.id, reason: 'Retry' }, key)).toEqual(first);
    expect([await shelf(setup.inventoryId), await materialStock(setup.materialId)]).toEqual([0, 20]);
  });
});

describe('supplier orders', () => {
  async function supplierOrder() {
    const setup = await workshop({ stock: 0 });
    const supplierId = uid();
    await db.query('insert into public.suppliers (id, name) values ($1, $2)', [supplierId, `Supplier ${supplierId}`]);
    const order = await as('manager', 'save_order', { supplier_id: supplierId, raw_material_id: setup.materialId, quantity_ordered: 10, unit_price: 50 });
    return { ...setup, supplierId, order };
  }

  it('can be cancelled by a manager while on the way', async () => {
    const { order } = await supplierOrder();
    await db.query(`update public.raw_material_orders set status = 'In Transit' where id = $1`, [order.id]);
    await refused(as('production', 'cancel_supplier_order', { id: order.id, reason: 'Lost' }), 'manager or administrator');
    expect(await as('manager', 'cancel_supplier_order', { id: order.id, reason: 'Supplier lost the load' })).toMatchObject({ status: 'Cancelled' });
  });

  it('can be deleted by an administrator only if nothing was ever received', async () => {
    const { order } = await supplierOrder();
    await refused(as('manager', 'delete_supplier_order', { id: order.id, reason: 'Typo' }), 'Only an administrator');
    expect(await as('admin', 'delete_supplier_order', { id: order.id, reason: 'Typo' })).toMatchObject({ deleted: true });

    const { order: received } = await supplierOrder();
    await as('manager', 'receive_delivery', { id: received.id, arrived: 10, damaged: 0, reference: 'DR-1' });
    await refused(as('admin', 'delete_supplier_order', { id: received.id, reason: 'Typo' }), 'was received');
  });
});

describe('recipes', () => {
  it('can be removed by a manager but not by production staff', async () => {
    const { productId, materialId } = await workshop();
    const recipe = await as('manager', 'save_recipe', { product_id: productId, raw_material_id: materialId, material_qty: 4, output_qty: 10 });
    await refused(as('production', 'delete_recipe', { id: recipe.id }), 'manager or administrator');
    expect(await as('manager', 'delete_recipe', { id: recipe.id })).toMatchObject({ deleted: true });
    expect(await all(db, 'select id from public.production_recipes where id = $1', [recipe.id])).toEqual([]);
  });
});

describe('suppliers', () => {
  const remove = (who, id, revision = 0) => asApi(db, who, async () =>
    (await one(db, 'select public.remove_supplier($1, $2) as r', [id, revision])).r);
  const restore = (who, id, revision) => asApi(db, who, async () =>
    (await one(db, 'select public.restore_supplier($1, $2) as r', [id, revision])).r);
  const revision = async (id) => Number((await one(db, 'select revision from public.suppliers where id = $1', [id])).revision);

  it('archives a supplier with history, keeps their orders, and refuses new orders to them', async () => {
    const { materialId } = await workshop({ stock: 0 });
    const supplierId = uid();
    await db.query('insert into public.suppliers (id, name) values ($1, $2)', [supplierId, 'Old Foam Co']);
    const order = await as('manager', 'save_order', { supplier_id: supplierId, raw_material_id: materialId, quantity_ordered: 5, unit_price: 10 });

    await refused(remove('admin', supplierId), 'has not arrived yet');
    await as('manager', 'cancel_supplier_order', { id: order.id, reason: 'Changed supplier' });
    await refused(remove('manager', supplierId), 'Only an administrator');
    expect(await remove('admin', supplierId, await revision(supplierId))).toEqual({ outcome: 'archived' });
    expect((await one(db, 'select status from public.suppliers where id = $1', [supplierId])).status).toBe('Archived');

    await refused(as('manager', 'save_order', { supplier_id: supplierId, raw_material_id: materialId, quantity_ordered: 5, unit_price: 10 }),
      'no longer used');
    expect(await restore('admin', supplierId, await revision(supplierId))).toEqual({ outcome: 'restored' });
    await expect(as('manager', 'save_order', { supplier_id: supplierId, raw_material_id: materialId, quantity_ordered: 5, unit_price: 10 }))
      .resolves.toMatchObject({ status: 'Ordered' });
  });

  it('deletes a supplier nothing refers to, and refuses a stale screen', async () => {
    const supplierId = uid();
    await db.query('insert into public.suppliers (id, name) values ($1, $2)', [supplierId, 'Typo Supplier']);
    await db.query(`update public.suppliers set name = 'Typo Supplier Inc' where id = $1`, [supplierId]);
    await refused(remove('admin', supplierId, 0), 'changed');
    expect(await remove('admin', supplierId, await revision(supplierId))).toEqual({ outcome: 'deleted' });
  });

  it('cannot be archived by writing the column directly', async () => {
    const supplierId = uid();
    await db.query('insert into public.suppliers (id, name) values ($1, $2)', [supplierId, 'Direct Write']);
    await refused(asApi(db, 'manager', () => db.query(`update public.suppliers set status = 'Archived' where id = $1`, [supplierId])),
      'Remove supplier');
  });
});

it('leaves the integrity report clean after every correction above', async () => {
  const report = await all(db, readSql('integrity_check.sql'));
  expect(report.filter((row) => Number(row.found) !== 0)).toEqual([]);
});
