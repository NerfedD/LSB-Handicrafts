// Stock movements, damage, count corrections, supplier receipts and product
// removal, against the real schema in PGlite (see src/test/database.js).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, readSql, rpc, signIn } from '../test/database';

let db;
let next = 100;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, 'admin'); });

/** A catalogue entry and its stock row, joined on code as the app does. */
async function shelf({ stock = 10, code = `P-${uid()}` } = {}) {
  const id = uid();
  await db.query(`insert into public.products (id, item_code, name) values ($1, $2, $3)`, [id, code, `Product ${code}`]);
  await db.query(`insert into public.inventory (id, sku, name, category, stock) values ($1, $2, $3, 'Test', $4)`,
    [id + 5000, code, `Product ${code}`, stock]);
  return { productId: id, inventoryId: id + 5000, code };
}

const stockOf = async (id) => (await one(db, 'select stock from public.inventory where id = $1', [id])).stock;
const movementsOf = (id) => all(db,
  'select kind, quantity_change, balance_after, reason, note, order_id, actor_name from public.stock_movements where inventory_id = $1 order by id', [id]);

const MIGRATIONS = ['migrations/20260924120000_stock_returns_loyalty.sql',
  'migrations/20260924190000_material_crud_and_damage_undo.sql'];

/**
 * Re-runs a migration to prove it is safe to run twice, then re-applies the
 * ones after it. A migration only ever redefines a function `create or
 * replace`, so running an old file on its own would leave the database a
 * release behind for every test that follows -- which is not what applying
 * migrations in order does, and is not what is being tested here.
 */
async function rerun(name, times = 1) {
  const from = MIGRATIONS.indexOf(name);
  for (let i = 0; i < times; i += 1) await db.exec(readSql(name));
  for (const later of MIGRATIONS.slice(from + 1)) await db.exec(readSql(later));
}

describe('stock movements', () => {
  it('records an opening count when a stock row is created with stock on it', async () => {
    const { inventoryId } = await shelf({ stock: 12 });
    expect(await movementsOf(inventoryId)).toEqual([
      expect.objectContaining({ kind: 'opening', quantity_change: 12, balance_after: 12 }),
    ]);
  });

  it('starts the history of stock that existed before the ledger, once', async () => {
    const { inventoryId } = await shelf({ stock: 0 });
    // As if the count had been set before the ledger existed.
    await db.exec(`alter table public.inventory disable trigger inventory_stock_movement;
      update public.inventory set stock = 9 where id = ${inventoryId};
      alter table public.inventory enable trigger inventory_stock_movement;`);
    await rerun('migrations/20260924120000_stock_returns_loyalty.sql', 2);
    expect(await movementsOf(inventoryId)).toEqual([
      expect.objectContaining({ kind: 'opening', quantity_change: 9, balance_after: 9, actor_name: 'System' }),
    ]);
  });

  it('records a sale against the order that took the goods', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    const orderId = uid();
    const items = [{ productId: inventoryId, name: 'Sheets', quantity: 4, stockUnits: 4, unitPrice: 100, kind: 'catalog' }];
    await db.query(`insert into public.orders (id, customer_name, items, total_amount) values ($1, 'Walk-in', $2, 400)`,
      [orderId, JSON.stringify(items)]);
    await rpc(db, 'order_command', 'complete', {
      orderId, expectedRevision: 0, deltas: [{ productId: inventoryId, delta: -4 }],
      order: { items: [{ ...items[0], committedUnits: 4 }], status: 'Completed', stockCommittedAt: '2026-09-24' },
    });
    expect((await movementsOf(inventoryId)).at(-1)).toMatchObject({
      kind: 'sale', quantity_change: -4, balance_after: 6, order_id: orderId, actor_name: 'admin person',
    });
  });

  it('refuses a direct shelf-count write from the API, even for an administrator', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await asApi(db, 'admin', async () => {
      await expect(db.query('update public.inventory set stock = 99 where id = $1', [inventoryId]))
        .rejects.toThrow(/recorded movement/);
    });
    expect(await stockOf(inventoryId)).toBe(10);
  });

  it('lets a manager edit the other stock-row fields, and not sales staff', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await asApi(db, 'sales', () => db.query('update public.inventory set low_stock_threshold = 1 where id = $1', [inventoryId]));
    expect((await one(db, 'select low_stock_threshold from public.inventory where id = $1', [inventoryId])).low_stock_threshold).toBe(50);
    await asApi(db, 'manager', () => db.query('update public.inventory set low_stock_threshold = 7 where id = $1', [inventoryId]));
    expect((await one(db, 'select low_stock_threshold from public.inventory where id = $1', [inventoryId])).low_stock_threshold).toBe(7);
  });

  it('keeps movements readable but never writable from the API', async () => {
    await shelf({ stock: 3 });
    await asApi(db, 'delivery', async () => {
      expect((await all(db, 'select id from public.stock_movements')).length).toBeGreaterThan(0);
      await expect(db.query(`insert into public.stock_movements (item_code, item_name, quantity_change, balance_after, kind, actor_name)
        values ('X', 'X', 1, 1, 'adjustment', 'Forged')`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe('damaged stock', () => {
  const damage = (inventoryId, quantity, extra = {}) =>
    ({ target: 'product', id: inventoryId, quantity, reason: 'broken', note: 'Dropped by the door', ...extra });

  it('takes damaged units off the shelf once, with who, why and when', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await signIn(db, 'production');
    const key = crypto.randomUUID();
    const first = await rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 3), key);
    // The same request again -- a retry after a lost response -- changes nothing.
    expect(await rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 3), key)).toEqual(first);
    expect(await stockOf(inventoryId)).toBe(7);
    expect((await movementsOf(inventoryId)).at(-1)).toMatchObject({
      kind: 'damage', quantity_change: -3, balance_after: 7, reason: 'broken', note: 'Dropped by the door',
      actor_name: 'production person',
    });
  });

  it('refuses more damage than is on the shelf, and leaves the count alone', async () => {
    const { inventoryId } = await shelf({ stock: 2 });
    await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 3))).rejects.toThrow(/Only 2 on the shelf/);
    expect(await stockOf(inventoryId)).toBe(2);
  });

  it('refuses sales and delivery staff', async () => {
    const { inventoryId } = await shelf({ stock: 5 });
    for (const who of ['sales', 'delivery']) {
      await signIn(db, who);
      await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 1))).rejects.toThrow(/production staff, managers/);
    }
    expect(await stockOf(inventoryId)).toBe(5);
  });

  it('asks for a note when the reason is "something else", and rejects nonsense counts', async () => {
    const { inventoryId } = await shelf({ stock: 5 });
    await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 1, { reason: 'other', note: '' })))
      .rejects.toThrow(/short note/);
    await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, -1))).rejects.toThrow(/whole number/);
    await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 1.5))).rejects.toThrow(/whole number/);
    await expect(rpc(db, 'stock_command', 'record_damage', damage(inventoryId, 0))).rejects.toThrow(/how many were damaged/);
  });
});

describe('count corrections', () => {
  it('sets the counted figure, records the difference, and is manager-only', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    const payload = { target: 'product', id: inventoryId, quantity: 13, expectedStock: 10, reason: 'recount' };
    await signIn(db, 'production');
    await expect(rpc(db, 'stock_command', 'correct_count', payload)).rejects.toThrow(/manager or administrator/);
    await signIn(db, 'manager');
    await rpc(db, 'stock_command', 'correct_count', payload);
    expect(await stockOf(inventoryId)).toBe(13);
    expect((await movementsOf(inventoryId)).at(-1)).toMatchObject({ kind: 'adjustment', quantity_change: 3, reason: 'recount' });
  });

  it('refuses a correction made against a count that has since moved', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await rpc(db, 'stock_command', 'record_damage', { target: 'product', id: inventoryId, quantity: 1, reason: 'crushed' });
    await expect(rpc(db, 'stock_command', 'correct_count',
      { target: 'product', id: inventoryId, quantity: 12, expectedStock: 10, reason: 'recount' })).rejects.toThrow(/changed since you opened/);
    expect(await stockOf(inventoryId)).toBe(9);
  });
});

describe('raw materials', () => {
  async function material(stock) {
    const result = await rpc(db, 'workshop_command', 'save_material',
      { sku: `RM-${uid()}`, name: 'Sheet 1 inch', material_type: 'sheet', unit: 'sheet', low_stock_threshold: 5 });
    const id = Number(result.id);
    if (stock) {
      await rpc(db, 'stock_command', 'correct_count', { target: 'material', id, quantity: stock, expectedStock: 0, reason: 'found' });
    }
    return id;
  }
  const lotsOf = (id) => all(db, 'select quantity, remaining, source from public.raw_material_lots where raw_material_id = $1 order by id', [id]);
  const materialStock = async (id) => (await one(db, 'select stock from public.raw_materials where id = $1', [id])).stock;

  it('keeps the lots in step with the count: damage uses the oldest lot first', async () => {
    const id = await material(4);
    await rpc(db, 'stock_command', 'correct_count', { target: 'material', id, quantity: 10, expectedStock: 4, reason: 'recount' });
    await rpc(db, 'stock_command', 'record_damage', { target: 'material', id, quantity: 5, reason: 'water' });
    expect(await materialStock(id)).toBe(5);
    expect(await lotsOf(id)).toEqual([
      { quantity: 4, remaining: 0, source: 'Count correction' },
      { quantity: 6, remaining: 5, source: 'Count correction' },
    ]);
    const kinds = (await all(db, 'select kind, quantity_change from public.stock_movements where raw_material_id = $1 order by id', [id]))
      .map((row) => `${row.kind} ${row.quantity_change}`);
    expect(kinds).toEqual(['adjustment 4', 'adjustment 6', 'damage -5']);
  });

  it('receives a supplier delivery once, with its reference, and records it against the purchase', async () => {
    const id = await material(0);
    const supplier = uid();
    await db.query(`insert into public.suppliers (id, name) values ($1, 'Davao Foam')`, [supplier]);
    const order = await rpc(db, 'workshop_command', 'save_order',
      { supplier_id: supplier, raw_material_id: id, quantity_ordered: 50, unit_price: 100, expected_delivery_date: '2026-09-30' });
    const receipt = { id: order.id, arrived: 50, damaged: 2, reason: 'Broken edges/corners', reference: 'DR-00451' };
    const key = crypto.randomUUID();
    const received = await rpc(db, 'workshop_command', 'receive_delivery', receipt, key);
    expect(received).toMatchObject({ status: 'Arrived', quantity_usable: 48, delivery_reference: 'DR-00451' });
    // A double-click (same request) and a second submission (new request).
    await rpc(db, 'workshop_command', 'receive_delivery', receipt, key);
    await expect(rpc(db, 'workshop_command', 'receive_delivery', receipt)).rejects.toThrow(/already received/);
    expect(await materialStock(id)).toBe(48);
    expect(await one(db, 'select kind, quantity_change, supplier_order_id, note from public.stock_movements where raw_material_id = $1', [id]))
      .toEqual({ kind: 'delivery', quantity_change: 48, supplier_order_id: Number(order.id), note: 'DR-00451' });
  });
});

describe('correcting a raw material', () => {
  const save = (data, key) => rpc(db, 'workshop_command', 'save_material', data, key);
  const read = (id) => one(db, 'select * from public.raw_materials where id = $1', [id]);

  async function material() {
    const row = await save({ sku: `RM-${uid()}`, name: 'Sheet 1 inch', material_type: 'sheet',
      unit: 'sheet', density: 1.5, thickness_in: 1, length_ft: 8, width_ft: 4, low_stock_threshold: 5 });
    return Number(row.id);
  }

  it('puts right every detail that could have been typed wrong', async () => {
    const id = await material();
    const before = await read(id);
    await save({ id, sku: 'rm-fixed-01', name: 'Sheet 2 inch', material_type: 'block', unit: 'block',
      density: '2.25', thickness_in: '2', length_ft: '10', width_ft: '5', low_stock_threshold: '12',
      expectedRevision: Number(before.revision) });
    expect(await read(id)).toMatchObject({
      sku: 'RM-FIXED-01', name: 'Sheet 2 inch', material_type: 'block', unit: 'block',
      density: '2.25', thickness_in: '2', length_ft: '10', width_ft: '5', low_stock_threshold: 12,
    });
  });

  it('clears a measurement that should never have been set, and leaves out fields alone', async () => {
    const id = await material();
    await save({ id, density: '' });
    const row = await read(id);
    expect(row.density).toBe(null);
    // Not in the payload, so not touched.
    expect(row).toMatchObject({ name: 'Sheet 1 inch', thickness_in: '1', length_ft: '8' });
  });

  it('refuses a save built on a stale read', async () => {
    const id = await material();
    await expect(save({ id, name: 'Later', expectedRevision: 99 }))
      .rejects.toThrow(/changed while you were editing/);
  });

  it('is a manager\'s job, and not a stranger\'s', async () => {
    const id = await material();
    await signIn(db, 'production');
    await expect(save({ id, name: 'Nope' })).rejects.toThrow(/manager or administrator/);
    await signIn(db, 'admin');
  });
});

describe('removing a raw material', () => {
  const remove = (id, revision) => one(db,
    'select public.remove_material($1, $2) as result', [id, revision]);
  const restore = (id, revision) => one(db,
    'select public.restore_material($1, $2) as result', [id, revision]);
  const read = (id) => one(db, 'select * from public.raw_materials where id = $1', [id]);

  async function material() {
    const row = await rpc(db, 'workshop_command', 'save_material',
      { sku: `RM-${uid()}`, name: 'Spare', material_type: 'sheet', unit: 'sheet', low_stock_threshold: 5 });
    return Number(row.id);
  }

  it('deletes one that nothing refers to, and only for an administrator', async () => {
    const id = await material();
    await signIn(db, 'manager');
    await expect(remove(id, 0)).rejects.toThrow(/Only an administrator/);
    await signIn(db, 'admin');
    expect((await remove(id, 0)).result).toEqual({ outcome: 'deleted' });
    expect(await read(id)).toBeUndefined();
  });

  it('archives one that has stock, keeping the count and its history', async () => {
    const id = await material();
    await rpc(db, 'stock_command', 'correct_count',
      { target: 'material', id, quantity: 7, expectedStock: 0, reason: 'found' });
    const before = await read(id);
    expect((await remove(id, Number(before.revision))).result).toEqual({ outcome: 'archived' });
    const after = await read(id);
    expect(after).toMatchObject({ status: 'Archived', stock: 7 });
    expect(await all(db, 'select id from public.stock_movements where raw_material_id = $1', [id]))
      .not.toHaveLength(0);
    // And it can be put back in use.
    expect((await restore(id, Number(after.revision))).result).toEqual({ outcome: 'restored' });
    expect((await read(id)).status).toBe('Active');
  });

  it('will not remove one a supplier order is still bringing in', async () => {
    const id = await material();
    const supplier = uid();
    await db.query(`insert into public.suppliers (id, name) values ($1, 'Davao Foam')`, [supplier]);
    await rpc(db, 'workshop_command', 'save_order',
      { supplier_id: supplier, raw_material_id: id, quantity_ordered: 10, unit_price: 50 });
    await expect(remove(id, Number((await read(id)).revision)))
      .rejects.toThrow(/has not arrived yet/);
  });

  it('refuses a removal built on a stale read', async () => {
    const id = await material();
    await expect(remove(id, 99)).rejects.toThrow(/changed/);
  });

  it('cannot be changed while it is archived', async () => {
    const id = await material();
    await rpc(db, 'stock_command', 'correct_count',
      { target: 'material', id, quantity: 3, expectedStock: 0, reason: 'found' });
    await remove(id, Number((await read(id)).revision));
    await expect(rpc(db, 'workshop_command', 'save_material', { id, name: 'Changed' }))
      .rejects.toThrow(/archived/);
  });
});

describe('undoing a damage record entered wrong', () => {
  const undo = (movementId, extra = {}, key) =>
    rpc(db, 'stock_command', 'undo_damage', { movementId, ...extra }, key);
  const lastDamage = async (column, id) => (await one(db,
    `select id from public.stock_movements where ${column} = $1 and kind = 'damage' order by id desc limit 1`,
    [id])).id;

  it('puts the quantity back as its own movement naming what it reverses', async () => {
    const { inventoryId } = await shelf({ stock: 20 });
    await rpc(db, 'stock_command', 'record_damage',
      { target: 'product', id: inventoryId, quantity: 8, reason: 'broken' });
    expect(await stockOf(inventoryId)).toBe(12);

    const damageId = await lastDamage('inventory_id', inventoryId);
    const result = await undo(damageId, { note: 'Counted the wrong pallet' });
    expect(result).toMatchObject({ target: 'product', undid: Number(damageId) });
    expect(await stockOf(inventoryId)).toBe(20);

    const last = await one(db,
      'select kind, quantity_change, balance_after, note, reverses_movement_id, actor_name from public.stock_movements where inventory_id = $1 order by id desc limit 1',
      [inventoryId]);
    expect(last).toEqual({ kind: 'damage_undone', quantity_change: 8, balance_after: 20,
      note: 'Counted the wrong pallet', reverses_movement_id: Number(damageId), actor_name: 'admin person' });
  });

  it('happens once, however many times it is asked for', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await rpc(db, 'stock_command', 'record_damage',
      { target: 'product', id: inventoryId, quantity: 4, reason: 'crushed' });
    const damageId = await lastDamage('inventory_id', inventoryId);

    const key = crypto.randomUUID();
    const first = await undo(damageId, {}, key);
    // The same request again replays its first answer; a new request is refused.
    expect(await undo(damageId, {}, key)).toEqual(first);
    await expect(undo(damageId)).rejects.toThrow(/already been undone/);
    expect(await stockOf(inventoryId)).toBe(10);
  });

  it('puts material stock back as a lot, so the lots still match the count', async () => {
    const row = await rpc(db, 'workshop_command', 'save_material',
      { sku: `RM-${uid()}`, name: 'Sheets', material_type: 'sheet', unit: 'sheet', low_stock_threshold: 5 });
    const id = Number(row.id);
    await rpc(db, 'stock_command', 'correct_count',
      { target: 'material', id, quantity: 10, expectedStock: 0, reason: 'found' });
    await rpc(db, 'stock_command', 'record_damage',
      { target: 'material', id, quantity: 6, reason: 'water' });

    const damageId = await lastDamage('raw_material_id', id);
    await undo(damageId);

    expect((await one(db, 'select stock from public.raw_materials where id = $1', [id])).stock).toBe(10);
    const lots = await all(db,
      'select quantity, remaining, source from public.raw_material_lots where raw_material_id = $1 order by id', [id]);
    expect(lots).toEqual([
      { quantity: 10, remaining: 4, source: 'Count correction' },
      { quantity: 6, remaining: 6, source: 'Damage undone' },
    ]);
    const total = lots.reduce((sum, lot) => sum + lot.remaining, 0);
    expect(total).toBe(10);
  });

  it('is for managers and administrators, and only for a damage record', async () => {
    const { inventoryId } = await shelf({ stock: 10 });
    await rpc(db, 'stock_command', 'record_damage',
      { target: 'product', id: inventoryId, quantity: 2, reason: 'handling' });
    const damageId = await lastDamage('inventory_id', inventoryId);

    await signIn(db, 'production');
    await expect(undo(damageId)).rejects.toThrow(/manager or administrator/);
    await signIn(db, 'admin');

    const opening = await one(db,
      `select id from public.stock_movements where inventory_id = $1 and kind = 'opening'`, [inventoryId]);
    await expect(undo(opening.id)).rejects.toThrow(/Only a damage record can be undone/);
    expect(await stockOf(inventoryId)).toBe(8);
  });
});

describe('removing a product', () => {
  const revisionOf = async (id) => Number((await one(db, 'select revision from public.products where id = $1', [id])).revision);

  it('deletes both halves of a product nothing refers to', async () => {
    const { productId, inventoryId } = await shelf({ stock: 4 });
    const result = await asApi(db, 'admin', async () =>
      (await one(db, 'select public.remove_product($1, $2) as r', [productId, await revisionOf(productId)])).r);
    expect(result).toEqual({ outcome: 'deleted' });
    expect(await all(db, 'select id from public.products where id = $1', [productId])).toEqual([]);
    expect(await all(db, 'select id from public.inventory where id = $1', [inventoryId])).toEqual([]);
  });

  it('archives a product that is on a past order, keeping both rows', async () => {
    const { productId, inventoryId } = await shelf({ stock: 4 });
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, status) values ($1, 'Walk-in', $2, 100, 'Completed')`,
      [uid(), JSON.stringify([{ productId: inventoryId, name: 'x', quantity: 1, unitPrice: 100 }])]);
    const result = await asApi(db, 'admin', async () =>
      (await one(db, 'select public.remove_product($1, $2) as r', [productId, await revisionOf(productId)])).r);
    expect(result).toEqual({ outcome: 'archived' });
    expect((await one(db, 'select status from public.products where id = $1', [productId])).status).toBe('Archived');
    expect(await stockOf(inventoryId)).toBe(4);
  });

  it('refuses while an order is waiting for it, and refuses anyone but an administrator', async () => {
    const { productId, inventoryId } = await shelf({ stock: 4 });
    await db.query(`insert into public.orders (id, customer_name, items, total_amount) values ($1, 'Walk-in', $2, 100)`,
      [uid(), JSON.stringify([{ productId: inventoryId, name: 'x', quantity: 1, unitPrice: 100 }])]);
    const revision = await revisionOf(productId);
    await asApi(db, 'manager', async () => {
      await expect(db.query('select public.remove_product($1, $2)', [productId, revision])).rejects.toThrow(/Only an administrator/);
    });
    await asApi(db, 'admin', async () => {
      await expect(db.query('select public.remove_product($1, $2)', [productId, revision])).rejects.toThrow(/still waiting/);
    });
  });
});

describe('integrity constraints', () => {
  it('allows only one stock row per code, whatever the case', async () => {
    const { code } = await shelf({ stock: 1 });
    await expect(db.query(`insert into public.inventory (sku, name, category) values ($1, 'dup', 'Test')`, [code.toLowerCase()]))
      .rejects.toThrow(/duplicate key/);
  });

  it('links an order\'s delivery by id on re-run, and the browser cannot move the link', async () => {
    const orderId = uid();
    const deliveryId = uid();
    await db.query(`insert into public.orders (id, customer_name, items) values ($1, 'Ana', '[]')`, [orderId]);
    await db.query(`insert into public.deliveries (id, product, location) values ($1, $2, 'Davao')`, [deliveryId, `Order #${orderId} - Ana`]);
    await rerun('migrations/20260924120000_stock_returns_loyalty.sql');
    expect((await one(db, 'select order_id from public.deliveries where id = $1', [deliveryId])).order_id).toBe(orderId);
    await asApi(db, 'admin', async () => {
      await expect(db.query('update public.deliveries set order_id = null where id = $1', [deliveryId])).rejects.toThrow(/different order/);
    });
  });

  it('never lets an order be deleted from the API', async () => {
    const orderId = uid();
    await db.query(`insert into public.orders (id, customer_name, items) values ($1, 'Ana', '[]')`, [orderId]);
    await asApi(db, 'admin', () => db.query('delete from public.orders where id = $1', [orderId]));
    expect(await all(db, 'select id from public.orders where id = $1', [orderId])).toHaveLength(1);
  });
});
