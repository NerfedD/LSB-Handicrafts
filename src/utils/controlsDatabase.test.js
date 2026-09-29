// Controlled inputs: material codes and units, measurements, promised dates,
// consumption of used-up or archived materials, categories and product photos,
// against the real schema in PGlite (see src/test/database.js).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, readSql, rpc, signIn } from '../test/database';

let db;
let next = 500;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, 'admin'); });

/** yyyy-mm-dd, `days` from the shop's today. */
const shopDay = async (days = 0) =>
  (await one(db, `select to_char(private.shop_today() + $1::int, 'YYYY-MM-DD') as d`, [days])).d;

const saveMaterial = (data, key) => rpc(db, 'workshop_command', 'save_material', data, key);

async function material({ stock = 0, status = 'Active', unit = 'sheet' } = {}) {
  const id = uid();
  await db.query(`insert into public.raw_materials (id, sku, name, unit, stock, status) values ($1, $2, $3, $4, $5, $6)`,
    [id, `RAW-${id}`, `Material ${id}`, unit, 0, status]);
  if (stock > 0) {
    await db.query(`insert into public.raw_material_lots (raw_material_id, quantity, remaining, source) values ($1, $2, $2, 'Test')`, [id, stock]);
    await db.query('update public.raw_materials set stock = $2 where id = $1', [id, stock]);
  }
  return id;
}

async function supplier() {
  const id = uid();
  await db.query(`insert into public.suppliers (id, name) values ($1, 'Davao Foam')`, [id]);
  return id;
}

async function product({ status = 'Active' } = {}) {
  const id = uid();
  const code = `P-${id}`;
  await db.query(`insert into public.products (id, item_code, name, status) values ($1, $2, $3, $4)`, [id, code, `Product ${id}`, status]);
  await db.query(`insert into public.inventory (id, sku, name, category, stock) values ($1, $2, $3, 'Test', 0)`, [id + 9000, code, `Product ${id}`]);
  return id;
}

describe('raw material details', () => {
  it('generates a code when none is typed, and never reuses one', async () => {
    const first = await saveMaterial({ sku: '', name: 'Hot glue sticks', material_type: 'adhesive', unit: 'stick', low_stock_threshold: '10' });
    const second = await saveMaterial({ sku: '  ', name: 'More glue', material_type: 'adhesive', unit: 'stick', low_stock_threshold: '10' });
    expect(first.sku).toMatch(/^RM-ADH-\d{3}$/);
    expect(second.sku).toMatch(/^RM-ADH-\d{3}$/);
    expect(second.sku).not.toBe(first.sku);
  });

  it('accepts a typed code in the defined format, upper-cased, and refuses anything else', async () => {
    const saved = await saveMaterial({ sku: 'ss-150-4x8', name: 'Sheet 1.5', unit: 'sheet', low_stock_threshold: '5' });
    expect(saved.sku).toBe('SS-150-4X8');
    for (const bad of ['SS_150', 'SS--150', '-SS', 'S', 'SS/150', "SS'150"]) {
      await expect(saveMaterial({ sku: bad, name: 'Bad code', unit: 'sheet', low_stock_threshold: '5' }))
        .rejects.toThrow(/letters, numbers and single hyphens/);
    }
    await expect(saveMaterial({ sku: 'Ss-150-4X8', name: 'Copy', unit: 'sheet', low_stock_threshold: '5' }))
      .rejects.toThrow(/already used by another material/);
  });

  it('keeps legitimate punctuation in a name', async () => {
    const saved = await saveMaterial({ name: 'Styro sheet 1/2" × 4ft (high-density), grade A&B', unit: 'sheet', low_stock_threshold: '5' });
    expect(saved.name).toBe('Styro sheet 1/2" × 4ft (high-density), grade A&B');
  });

  it('stores one spelling of a unit and refuses a unit that is not a word', async () => {
    const saved = await saveMaterial({ name: 'Wire roll', material_type: 'wire', unit: '  Roll ', low_stock_threshold: '2' });
    expect(saved.unit).toBe('roll');
    await expect(saveMaterial({ name: 'Glue', material_type: 'adhesive', unit: 'bottle!', low_stock_threshold: '2' }))
      .rejects.toThrow(/unit in letters only/);
  });

  it('takes whole-number measurements without decimals, and refuses negative or oversized ones', async () => {
    const saved = await saveMaterial({ name: 'Block', material_type: 'block', unit: 'block', low_stock_threshold: '0',
      density: '30', weight_kg: '2', thickness_in: '12', length_ft: '8', width_ft: '.5' });
    expect(saved).toMatchObject({ density: 30, weight_kg: 2, thickness_in: 12, length_ft: 8, width_ft: 0.5 });
    await expect(saveMaterial({ id: saved.id, density: '-5' })).rejects.toThrow(/density must be a number above 0/i);
    await expect(saveMaterial({ id: saved.id, thickness_in: '0' })).rejects.toThrow(/thickness must be more than 0/i);
    await expect(saveMaterial({ id: saved.id, length_ft: '9999' })).rejects.toThrow(/no more than 200 feet/);
    await expect(saveMaterial({ id: saved.id, weight_kg: '1.23456' })).rejects.toThrow(/at most 3 decimal places/);
    await expect(saveMaterial({ id: saved.id, low_stock_threshold: '2.5' })).rejects.toThrow(/whole number/);
  });

  it('updates every detail, weight included, and clears a measurement sent empty', async () => {
    const saved = await saveMaterial({ name: 'Sheet', unit: 'sheet', low_stock_threshold: '3', density: '20', weight_kg: '1.5' });
    const changed = await saveMaterial({ id: saved.id, expectedRevision: saved.revision, name: 'Sheet, heavier',
      unit: 'board', density: '', weight_kg: '2.25', thickness_in: '1', low_stock_threshold: '4' });
    expect(changed).toMatchObject({ name: 'Sheet, heavier', unit: 'board', density: null, weight_kg: 2.25, thickness_in: 1, low_stock_threshold: 4 });
  });

  it('leaves a code or unit saved before these rules alone until somebody changes it', async () => {
    const id = uid();
    await db.query(`insert into public.raw_materials (id, sku, name, unit) values ($1, 'old code_1', 'Old one', 'pcs.')`, [id]);
    const changed = await saveMaterial({ id, sku: 'old code_1', unit: 'pcs.', low_stock_threshold: '7' });
    expect(changed).toMatchObject({ sku: 'old code_1', unit: 'pcs.', low_stock_threshold: 7 });
  });
});

describe('promised dates', () => {
  it('refuses a supplier order promised before today, and accepts today', async () => {
    const [m, s] = [await material(), await supplier()];
    const base = { supplier_id: s, raw_material_id: m, quantity_ordered: '10', unit_price: '25' };
    await expect(rpc(db, 'workshop_command', 'save_order', { ...base, expected_delivery_date: await shopDay(-1) }))
      .rejects.toThrow(/has already passed/);
    const order = await rpc(db, 'workshop_command', 'save_order', { ...base, expected_delivery_date: await shopDay(0) });
    expect(order.status).toBe('Delivery Scheduled');
  });

  it('lets an old order keep its past date while its notes are corrected', async () => {
    const [m, s] = [await material(), await supplier()];
    const order = await rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '5', unit_price: '10' });
    const past = await shopDay(-10);
    await db.exec(`alter table public.raw_material_orders disable trigger material_orders_guard_promised;
      update public.raw_material_orders set expected_delivery_date = '${past}' where id = ${order.id};
      alter table public.raw_material_orders enable trigger material_orders_guard_promised;`);
    const same = await rpc(db, 'workshop_command', 'save_order', { id: order.id, expected_delivery_date: past, carrier_notes: 'Driver: 0917 000 0000' });
    expect(same.carrier_notes).toBe('Driver: 0917 000 0000');
    await expect(rpc(db, 'workshop_command', 'save_order', { id: order.id, expected_delivery_date: await shopDay(-2) }))
      .rejects.toThrow(/has already passed/);
  });

  it('refuses a customer delivery promised before today, but not an edit that leaves an old date alone', async () => {
    await expect(db.query(`insert into public.deliveries (id, product, location, status, due_on) values ($1, 'Order #1 - A', 'Davao', 'Not Sent', $2)`,
      [uid(), await shopDay(-1)])).rejects.toThrow(/has already passed/);
    const id = uid();
    await db.query(`insert into public.deliveries (id, product, location, status, due_on) values ($1, 'Order #2 - B', 'Davao', 'Not Sent', $2)`,
      [id, await shopDay(1)]);
    await db.exec(`alter table public.deliveries disable trigger deliveries_guard_due_on;
      update public.deliveries set due_on = '${await shopDay(-5)}' where id = ${id};
      alter table public.deliveries enable trigger deliveries_guard_due_on;`);
    await db.query(`update public.deliveries set driver = 'Jun', due_on = due_on where id = $1`, [id]);
    expect((await one(db, 'select driver from public.deliveries where id = $1', [id])).driver).toBe('Jun');
    await expect(db.query(`update public.deliveries set due_on = $2 where id = $1`, [id, await shopDay(-1)]))
      .rejects.toThrow(/has already passed/);
  });
});

describe('supplier orders and batches refuse what cannot be used', () => {
  it('explains a fractional quantity or a negative price instead of a database error', async () => {
    const [m, s] = [await material(), await supplier()];
    await expect(rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '1.5', unit_price: '5' }))
      .rejects.toThrow(/quantity ordered must be a whole number/);
    await expect(rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '2', unit_price: '-5' }))
      .rejects.toThrow(/price per unit/);
    await expect(rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '0', unit_price: '5' }))
      .rejects.toThrow(/between 1 and/);
  });

  it('corrects the quantity and price of an order not yet sent, once, and not after it leaves', async () => {
    const [m, s] = [await material(), await supplier()];
    const order = await rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '10', unit_price: '25' });
    const key = crypto.randomUUID();
    const fix = { id: order.id, quantity_ordered: '12', unit_price: '24.50', expected_delivery_date: '', carrier_notes: '' };
    const fixed = await rpc(db, 'workshop_command', 'save_order', fix, key);
    expect(fixed).toMatchObject({ quantity_ordered: 12, total_cost: 294 });
    expect(Number(fixed.unit_price)).toBe(24.5);
    // A retry of the same request replays; it does not apply anything twice.
    expect(await rpc(db, 'workshop_command', 'save_order', fix, key)).toEqual(fixed);
    await expect(rpc(db, 'workshop_command', 'save_order', { ...fix, quantity_ordered: '2.5' })).rejects.toThrow(/whole number/);
    await db.query(`update public.raw_material_orders set status = 'In Transit' where id = $1`, [order.id]);
    await expect(rpc(db, 'workshop_command', 'save_order', { ...fix, quantity_ordered: '99' })).rejects.toThrow(/has not left the supplier/);
    expect((await one(db, 'select quantity_ordered from public.raw_material_orders where id = $1', [order.id])).quantity_ordered).toBe(12);
    await signIn(db, 'sales');
    await expect(rpc(db, 'workshop_command', 'save_order', { ...fix, quantity_ordered: '1' })).rejects.toThrow(/Only a manager/);
  });

  it('refuses to order an archived material', async () => {
    const [m, s] = [await material({ status: 'Archived' }), await supplier()];
    await expect(rpc(db, 'workshop_command', 'save_order', { supplier_id: s, raw_material_id: m, quantity_ordered: '2', unit_price: '5' }))
      .rejects.toThrow(/no longer in use/);
  });

  it('refuses a batch on a used-up material, on an archived one, and for more than is free', async () => {
    const p = await product();
    const batch = (m, qty) => rpc(db, 'workshop_command', 'start_batch',
      { product_id: p, raw_material_id: m, material_qty: String(qty), output_qty: '10', assigned_staff_id: 11 });
    await expect(batch(await material({ stock: 0 }), 1)).rejects.toThrow(/has none free/);
    await expect(batch(await material({ stock: 20, status: 'Archived' }), 1)).rejects.toThrow(/no longer in use/);
    const m = await material({ stock: 20 });
    await batch(m, 15);
    await expect(batch(m, 6)).rejects.toThrow(/Only 5 sheet of .* are free/);
    await expect(batch(m, 5)).resolves.toMatchObject({ status: 'Queued', raw_material_used_qty: 5 });
    await expect(batch(m, 1)).rejects.toThrow(/has none free/);
  });

  it('refuses a batch or recipe for a product that is no longer sold', async () => {
    const p = await product({ status: 'Archived' });
    const m = await material({ stock: 10 });
    await expect(rpc(db, 'workshop_command', 'start_batch',
      { product_id: p, raw_material_id: m, material_qty: '1', output_qty: '1', assigned_staff_id: 11 })).rejects.toThrow(/no longer sold/);
    await expect(rpc(db, 'workshop_command', 'save_recipe',
      { product_id: p, raw_material_id: m, material_qty: '1', output_qty: '1' })).rejects.toThrow(/no longer sold/);
  });

  it('replays a saved request instead of re-checking it', async () => {
    const [m, s] = [await material(), await supplier()];
    const key = crypto.randomUUID();
    const data = { supplier_id: s, raw_material_id: m, quantity_ordered: '3', unit_price: '9' };
    const first = await rpc(db, 'workshop_command', 'save_order', data, key);
    await db.query(`update public.raw_materials set status = 'Archived' where id = $1`, [m]);
    expect(await rpc(db, 'workshop_command', 'save_order', data, key)).toEqual(first);
  });
});

describe('product measurements', () => {
  it('refuses a new negative or zero size but lets an old row be edited around one', async () => {
    await expect(db.query(`insert into public.products (id, item_code, name, diameter_in) values ($1, $2, 'Ball', -4)`, [uid(), `B-${next}`]))
      .rejects.toThrow(/width across must be more than 0/);
    const id = uid();
    await db.exec(`alter table public.products disable trigger products_guard_measurements;
      insert into public.products (id, item_code, name, width_ft) values (${id}, 'LEGACY-${id}', 'Old sheet', 0);
      alter table public.products enable trigger products_guard_measurements;`);
    await db.query('update public.products set unit_price = 99 where id = $1', [id]);
    expect(Number((await one(db, 'select unit_price from public.products where id = $1', [id])).unit_price)).toBe(99);
  });
});

describe('categories', () => {
  const command = async (action, data) =>
    (await one(db, 'select public.category_command($1, $2) as r', [action, JSON.stringify(data)])).r;

  it('files a stock row under the existing spelling, whatever capitals or spaces it was typed with', async () => {
    const { category } = await command('add', { name: 'Wall Art' });
    const id = uid();
    await db.query(`insert into public.inventory (id, sku, name, category) values ($1, $2, 'Piece', '  wall   ART ')`, [id, `W-${id}`]);
    expect((await one(db, 'select category from public.inventory where id = $1', [id])).category).toBe(category.name);
    expect(await all(db, `select name from public.product_categories where lower(name) = 'wall art'`)).toHaveLength(1);
  });

  it('answers a duplicate add with the category that already exists', async () => {
    const first = await command('add', { name: 'Centrepieces' });
    const again = await command('add', { name: ' centrepieces ' });
    expect(again).toMatchObject({ created: false, category: { id: first.category.id, name: 'Centrepieces' } });
  });

  it('merges the spellings already on file when the migration runs', async () => {
    await db.exec('alter table public.inventory disable trigger inventory_canonical_category');
    for (const label of ['Stage Props', 'stage props', 'Stage  Props ', 'Stage Props']) {
      const id = uid();
      await db.query('insert into public.inventory (id, sku, name, category) values ($1, $2, $3, $4)', [id, `S-${id}`, 'Prop', label]);
    }
    await db.exec('alter table public.inventory enable trigger inventory_canonical_category');
    await db.exec(readSql('migrations/20260929120000_controlled_inputs_and_photos.sql'));
    expect(await all(db, `select distinct category from public.inventory where lower(category) like 'stage%'`))
      .toEqual([{ category: 'Stage Props' }]);
    expect(await all(db, `select name from public.product_categories where lower(name) like 'stage%'`))
      .toEqual([{ name: 'Stage Props' }]);
  });

  it('renames a category everywhere, and refuses a rename onto another one', async () => {
    const { category } = await command('add', { name: 'Garlands' });
    const id = uid();
    await db.query(`insert into public.inventory (id, sku, name, category) values ($1, $2, 'Garland', 'Garlands')`, [id, `G-${id}`]);
    await command('rename', { id: category.id, name: 'Garlands & Swags' });
    expect((await one(db, 'select category from public.inventory where id = $1', [id])).category).toBe('Garlands & Swags');
    await command('add', { name: 'Toppers' });
    await expect(command('rename', { id: category.id, name: 'toppers' })).rejects.toThrow(/already a category called "Toppers"/);
  });

  it('removes only a category nothing is filed under', async () => {
    const { category } = await command('add', { name: 'Seasonal' });
    const id = uid();
    await db.query(`insert into public.inventory (id, sku, name, category) values ($1, $2, 'Tree', 'Seasonal')`, [id, `T-${id}`]);
    await expect(command('remove', { id: category.id })).rejects.toThrow(/1 product is in "Seasonal"/);
    await db.query(`update public.inventory set category = 'Test' where id = $1`, [id]);
    await expect(command('remove', { id: category.id })).resolves.toEqual({ removed: category.id });
  });

  it('is a manager job, and the list cannot be written directly', async () => {
    await signIn(db, 'sales');
    await expect(command('add', { name: 'Anything' })).rejects.toThrow(/Only a manager or administrator/);
    await asApi(db, 'manager', async () => {
      await expect(db.query(`insert into public.product_categories (name) values ('Sneaky')`)).rejects.toThrow(/permission denied/);
      expect((await all(db, 'select name from public.product_categories')).length).toBeGreaterThan(0);
    });
  });
});

describe('product photos', () => {
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const save = async (productId, url) =>
    (await one(db, 'select public.save_product_image($1, $2) as r', [productId, url])).r;

  it('saves, replaces and removes a photo, for a manager', async () => {
    const p = await product();
    await signIn(db, 'manager');
    await save(p, PHOTO);
    await save(p, 'data:image/png;base64,iVBORw0KGgo=');
    expect(await one(db, 'select data_url, updated_by from public.product_images where product_id = $1', [p]))
      .toEqual({ data_url: 'data:image/png;base64,iVBORw0KGgo=', updated_by: 'manager person' });
    await asApi(db, 'sales', async () => {
      expect(await all(db, 'select product_id from public.product_images where product_id = $1', [p])).toHaveLength(1);
    });
    await signIn(db, 'manager');
    expect(await save(p, null)).toMatchObject({ removed: true });
    expect(await all(db, 'select 1 from public.product_images where product_id = $1', [p])).toHaveLength(0);
  });

  it('refuses another role, and anything that is not a photo', async () => {
    const p = await product();
    await signIn(db, 'sales');
    await expect(save(p, PHOTO)).rejects.toThrow(/Only a manager or administrator/);
    await signIn(db, 'admin');
    await expect(save(p, 'data:text/html;base64,PGI+')).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(save(p, `data:image/jpeg;base64,${'A'.repeat(1_600_000)}`)).rejects.toThrow(/too large/);
  });

  it('goes with its product when the product is deleted', async () => {
    const p = await product();
    await save(p, PHOTO);
    await db.query('delete from public.inventory where id = $1', [p + 9000]);
    await db.query('delete from public.products where id = $1', [p]);
    expect(await all(db, 'select 1 from public.product_images where product_id = $1', [p])).toHaveLength(0);
  });
});
