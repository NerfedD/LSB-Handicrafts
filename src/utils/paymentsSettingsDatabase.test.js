// Payments, business settings, staff photos and signing somebody else out,
// against the real schema in PGlite (see src/test/database.js).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, emailOf, freshDatabase, one, signIn, STAFF } from '../test/database';

let db;
let next = 7000;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, 'admin'); });

const today = async () => (await one(db, `select to_char(private.shop_today(), 'YYYY-MM-DD') as d`)).d;

/** An order worth `total`, written `ageDays` ago. */
async function order(total, { ageDays = 0, status = 'Pending' } = {}) {
  const id = uid();
  const items = [{ name: 'Custom sculpture', kind: 'custom', quantity: 1, unitPrice: total, lineTotal: total }];
  await db.query(`insert into public.orders (id, customer_name, items, total_amount, status, created_at)
    values ($1, 'Bautista Party Supplies', $2, $3, $4, now() - make_interval(days => $5))`,
  [id, JSON.stringify(items), total, status, ageDays]);
  return id;
}

const pay = (who, ids, amount, { method = 'cash', reference = null, on = null, key = crypto.randomUUID() } = {}) =>
  asApi(db, who, async () => (await one(db,
    'select public.record_payment($1, $2, $3, $4, $5::date, $6, $7) as result',
    [ids, amount, method, reference, on ?? (await today()), null, key])).result);

const paid = async (id) => Number((await one(db,
  'select coalesce(sum(amount), 0) as n from public.order_payments where order_id = $1', [id])).n);

describe('payments', () => {
  it('records a payment and keeps what is owed', async () => {
    const id = await order(1000);
    const result = await pay('sales', [id], 400, { method: 'gcash', reference: 'GC-12345' });
    expect(result.payments).toHaveLength(1);
    expect(await paid(id)).toBe(400);
    const view = await one(db, 'select paid_amount, payment_count from public.order_paid where order_id = $1', [id]);
    expect([Number(view.paid_amount), Number(view.payment_count)]).toEqual([400, 1]);
  });

  it('settles several orders oldest first and refuses more than they owe together', async () => {
    const older = await order(300, { ageDays: 3 });
    const newer = await order(500, { ageDays: 1 });
    await expect(pay('delivery', [newer, older], 900)).rejects.toThrow(/more than is owed/);
    await pay('delivery', [newer, older], 450);
    expect([await paid(older), await paid(newer)]).toEqual([300, 150]);
  });

  it('replays a retried request instead of taking the money twice', async () => {
    const id = await order(800);
    const key = crypto.randomUUID();
    await pay('sales', [id], 200, { key });
    const again = await pay('sales', [id], 200, { key });
    expect(again.replayed).toBe(true);
    expect(await paid(id)).toBe(200);
  });

  it('counts refunds, and refuses a cancelled or a fully paid order', async () => {
    const refunded = await order(1000);
    await db.query('update public.orders set refunded_amount = 300 where id = $1', [refunded]);
    await expect(pay('sales', [refunded], 800)).rejects.toThrow(/more than is owed/);
    await pay('sales', [refunded], 700);
    await expect(pay('sales', [refunded], 1)).rejects.toThrow(/already paid/);

    const cancelled = await order(500, { status: 'Cancelled' });
    await expect(pay('sales', [cancelled], 100)).rejects.toThrow(/cancelled/);
  });

  it('checks the method, reference, amount and date', async () => {
    const id = await order(500);
    await expect(pay('sales', [id], 100, { method: 'bank' })).rejects.toThrow(/reference number/);
    await expect(pay('sales', [id], 100, { method: 'crypto' })).rejects.toThrow(/how it was paid/);
    await expect(pay('sales', [id], 10.005)).rejects.toThrow(/two decimal places/);
    await expect(pay('sales', [id], 0)).rejects.toThrow(/amount received/);
    const tomorrow = (await one(db, `select to_char(private.shop_today() + 1, 'YYYY-MM-DD') as d`)).d;
    await expect(pay('sales', [id], 100, { on: tomorrow })).rejects.toThrow(/after today/);
  });

  it('lets sales and drivers record, production not, and only managers remove', async () => {
    const id = await order(500);
    await expect(pay('production', [id], 100)).rejects.toThrow(/Only sales, delivery staff or a manager/);
    const { payments } = await pay('sales', [id], 100);
    const remove = (who) => asApi(db, who, () => one(db, 'select public.remove_payment($1) as r', [payments[0].id]));
    await expect(remove('sales')).rejects.toThrow(/Only a manager/);
    await remove('manager');
    expect(await paid(id)).toBe(0);
    const log = await all(db, `select description from public.activity_log where subject = $1 order by at`, [`Order #${id}`]);
    expect(log.map((row) => row.description).join(' | ')).toMatch(/received.*removed/);
  });

  it('cannot be written straight into the table from the browser', async () => {
    const id = await order(500);
    await expect(asApi(db, 'admin', () => db.query(
      `insert into public.order_payments (order_id, amount, method, received_on) values ($1, 100, 'cash', current_date)`, [id])))
      .rejects.toThrow(/permission denied/);
  });
});

describe('business settings', () => {
  const update = (who, set) => asApi(db, who, () => db.query(`update public.business_settings set ${set} where id = 1 returning *`));

  it('is one row everybody can read and only an administrator can change', async () => {
    const row = await asApi(db, 'production', () => one(db, 'select business_name from public.business_settings'));
    expect(row.business_name).toBe('LSB Handicrafts');
    const refused = await update('manager', `phone = '0917 000 0000'`);
    expect(refused.rows).toHaveLength(0);
    const saved = await update('admin', `phone = '(082) 221 1234', delivery_areas = array[' Matina', 'Toril', 'Matina', '']`);
    expect(saved.rows[0]).toMatchObject({ phone: '(082) 221 1234', delivery_areas: ['Matina', 'Toril'], updated_by: 'admin person' });
    expect(Number(saved.rows[0].revision)).toBeGreaterThan(0);
  });

  it('refuses a bad TIN, email, day or opening hours', async () => {
    await expect(update('admin', `tin = '12-34'`)).rejects.toThrow(/check constraint/);
    await expect(update('admin', `email = 'not an email'`)).rejects.toThrow(/check constraint/);
    await expect(update('admin', `open_days = array['Mon', 'Funday']`)).rejects.toThrow(/check constraint/);
    await expect(update('admin', `opens_at = '17:00', closes_at = '08:00'`)).rejects.toThrow(/check constraint/);
    await update('admin', `tin = '123-456-789-000', email = 'office@lsb.test', opens_at = '08:00', closes_at = '17:00'`);
  });
});

describe('staff photos', () => {
  const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
  const save = (who, url) => asApi(db, who, () => one(db, 'select public.save_own_photo($1) as r', [url]));

  it('lets each person set and remove only their own photo', async () => {
    await save('production', PHOTO);
    const seen = await asApi(db, 'sales', () => all(db, 'select staff_id from public.staff_photos'));
    expect(seen.map((row) => Number(row.staff_id))).toContain(STAFF.production.id);
    await save('production', null);
    expect(await all(db, 'select 1 from public.staff_photos where staff_id = $1', [STAFF.production.id])).toHaveLength(0);
    await expect(save('sales', 'data:text/html;base64,PGI+')).rejects.toThrow(/JPEG, PNG or WebP/);
  });
});

describe('signing somebody else out', () => {
  async function login(who) {
    const user = await one(db, 'insert into auth.users (email) values ($1) returning id', [emailOf(who)]);
    await db.query('insert into auth.sessions (user_id) values ($1), ($1)', [user.id]);
    return user.id;
  }
  const signOut = (who, staffId) => asApi(db, who, async () => (await one(db, 'select public.sign_out_staff($1) as r', [staffId])).r);

  it('ends every session of another account, for an administrator only', async () => {
    const user = await login('delivery');
    await expect(signOut('manager', STAFF.delivery.id)).rejects.toThrow(/Only an administrator/);
    expect(await signOut('admin', STAFF.delivery.id)).toEqual({ ended: 2 });
    expect(await all(db, 'select 1 from auth.sessions where user_id = $1', [user])).toHaveLength(0);
    await expect(signOut('admin', STAFF.admin.id)).rejects.toThrow(/your own profile/);
  });
});

describe('payment terms', () => {
  it('gives customers 30 days unless set to 60, and refuses any other term', async () => {
    const id = uid();
    await db.query(`insert into public.customers (id, name) values ($1, 'Terms customer')`, [id]);
    expect((await one(db, 'select payment_term_days from public.customers where id = $1', [id])).payment_term_days).toBe(30);
    await db.query('update public.customers set payment_term_days = 60 where id = $1', [id]);
    await expect(db.query('update public.customers set payment_term_days = 45 where id = $1', [id])).rejects.toThrow(/check constraint/);
  });

  it('lets only a manager change an order\'s term once it is written', async () => {
    const id = await order(900);
    const setTerm = (who, days) => asApi(db, who, () => db.query('update public.orders set payment_term_days = $2 where id = $1', [id, days]));
    await expect(setTerm('sales', 60)).rejects.toThrow(/Only an administrator or a manager can change an order's payment terms/);
    await setTerm('manager', 60);
    expect((await one(db, 'select payment_term_days from public.orders where id = $1', [id])).payment_term_days).toBe(60);
  });
});

describe('supplier payments', () => {
  async function supplierOrder(method = 'cod') {
    const supplier = uid();
    const material = uid();
    await db.query(`insert into public.suppliers (id, name) values ($1, 'Foamtech')`, [supplier]);
    await db.query(`insert into public.raw_materials (id, sku, name, unit, stock) values ($1, $2, 'Glue', 'bottle', 0)`, [material, `RAW-${material}`]);
    const row = await one(db, `insert into public.raw_material_orders (supplier_id, raw_material_id, quantity_ordered, unit_price, created_by_staff_id, payment_method)
      values ($1, $2, 5, 100, $3, $4) returning id, paid_at`, [supplier, material, STAFF.manager.id, method]);
    return row;
  }
  const paidAt = async (id) => (await one(db, 'select paid_at from public.raw_material_orders where id = $1', [id])).paid_at;

  it('counts a card order as paid when placed, and a COD order when it arrives', async () => {
    const card = await supplierOrder('card');
    expect(card.paid_at).not.toBeNull();
    const cod = await supplierOrder('cod');
    expect(cod.paid_at).toBeNull();
    await db.query(`update public.raw_material_orders set status = 'Arrived', quantity_arrived = 5 where id = $1`, [cod.id]);
    expect(await paidAt(cod.id)).not.toBeNull();
  });

  it('lets a manager correct the method until the delivery arrives', async () => {
    const order = await supplierOrder('cod');
    const set = (who, method) => asApi(db, who, () => one(db, 'select public.set_supplier_payment($1, $2) as r', [order.id, method]));
    await expect(set('production', 'card')).rejects.toThrow(/Only a manager or administrator/);
    expect((await set('manager', 'card')).r.paid_at).not.toBeNull();
    expect((await set('manager', 'cod')).r.paid_at).toBeNull();
    await db.query(`update public.raw_material_orders set status = 'Arrived', quantity_arrived = 5 where id = $1`, [order.id]);
    await expect(set('manager', 'card')).rejects.toThrow(/already closed/);
  });
});
