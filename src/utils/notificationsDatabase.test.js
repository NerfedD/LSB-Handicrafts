// In-app notifications against the real schema in PGlite (src/test/database.js).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, signIn, STAFF } from '../test/database';

let db;
let next = 9100;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, 'admin'); });

const inbox = (who) => asApi(db, who, () => all(db, 'select event, title, view, record_id, read_at from public.notifications order by id'));
const events = async (who) => (await inbox(who)).map((n) => n.event);
const items = (total) => JSON.stringify([{ name: 'Custom piece', kind: 'custom', quantity: 1, unitPrice: total, lineTotal: total }]);

describe('alerts raised when something happens', () => {
  it('tells everyone who may see orders about a new one, except whoever took it', async () => {
    const id = uid();
    await asApi(db, 'sales', () => db.query(
      `insert into public.orders (id, customer_name, items, total_amount) values ($1, 'Reyes Events', $2, 500)`, [id, items(500)]));
    const managers = await inbox('manager');
    expect(managers.find((n) => n.record_id === String(id) || Number(n.record_id) === id)).toMatchObject({ event: 'order_new', view: 'order-detail' });
    expect(await events('sales')).not.toContain('order_new');
    // Drivers do not hear about orders at all.
    expect(await events('delivery')).not.toContain('order_new');
  });

  it('follows each person\'s own choice, and refuses events their role cannot have', async () => {
    const saved = await asApi(db, 'production', () => one(db, 'select public.save_notification_settings($1) as r', [['batch_qc', 'payment_overdue']]));
    expect(saved.r.in_app).toEqual(['batch_qc']);
    const id = uid();
    await db.query(`insert into public.orders (id, customer_name, items, total_amount) values ($1, 'Someone', $2, 100)`, [id, items(100)]);
    expect((await inbox('production')).some((n) => Number(n.record_id) === id)).toBe(false);
  });

  it('raises a low shelf once per crossing of its warning level', async () => {
    const id = uid();
    await db.query(`insert into public.inventory (id, sku, name, category, stock, low_stock_threshold) values ($1, $2, 'Styro Ball 9 inch', 'Test', 30, 10)`, [id, `NB-${id}`]);
    const lowFor = async () => (await inbox('sales')).filter((n) => n.event === 'stock_low' && n.title.includes('Styro Ball 9 inch')).length;
    // Each change is made by the administrator, so the person checking is not
    // the one who caused it (and so is not left out of the alert).
    const setStock = async (stock) => { await signIn(db, 'admin'); await db.query('update public.inventory set stock = $2 where id = $1', [id, stock]); };
    await setStock(12);
    expect(await lowFor()).toBe(0);
    await setStock(8);
    await setStock(5);
    expect(await lowFor()).toBe(1);
  });

  it('lets a person mark only their own alerts read', async () => {
    const mine = await asApi(db, 'manager', () => db.query(`update public.notifications set read_at = now() returning staff_id`));
    expect(new Set(mine.rows.map((r) => Number(r.staff_id)))).toEqual(new Set([STAFF.manager.id]));
    await expect(asApi(db, 'manager', () => db.query(`update public.notifications set title = 'changed'`))).rejects.toThrow(/permission denied/);
  });
});

describe('alerts raised by the clock', () => {
  it('raises a late delivery and an overdue payment once, however often it is checked', async () => {
    const delivery = uid();
    // A past promised day can no longer be typed in (guard_promised_date), so
    // the late delivery is written with the guards off, as if it had been
    // promised days ago.
    await db.exec('set session_replication_role = replica');
    try {
      await db.query(`insert into public.deliveries (id, product, location, status, due_on) values ($1, 'Order #1 - Late', 'Matina', 'Ready To Go', private.shop_today() - 2)`, [delivery]);
    } finally {
      await db.exec('set session_replication_role = origin');
    }
    const order = uid();
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, status, payment_term_days, stock_committed_at)
      values ($1, 'Slow Payer', $2, 1000, 'Completed', 30, now() - interval '40 days')`, [order, items(1000)]);
    const refresh = () => asApi(db, 'sales', () => one(db, 'select public.refresh_alerts() as r'));
    await refresh();
    await refresh();
    const sales = await inbox('sales');
    expect(sales.filter((n) => n.event === 'delivery_late' && Number(n.record_id) === delivery)).toHaveLength(1);
    expect(sales.filter((n) => n.event === 'payment_overdue' && Number(n.record_id) === order)).toHaveLength(1);
    expect(await events('production')).not.toContain('payment_overdue');
  });

  it('says nothing about a payment on terms that is paid or not yet due', async () => {
    const paidUp = uid();
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, status, payment_term_days, stock_committed_at)
      values ($1, 'Paid Up', $2, 500, 'Completed', 30, now() - interval '40 days')`, [paidUp, items(500)]);
    await db.query(`insert into public.order_payments (order_id, amount, method, received_on) values ($1, 500, 'cash', current_date)`, [paidUp]);
    const notDue = uid();
    await db.query(`insert into public.orders (id, customer_name, items, total_amount, status, payment_term_days, stock_committed_at)
      values ($1, 'Not Yet', $2, 500, 'Completed', 60, now() - interval '40 days')`, [notDue, items(500)]);
    await asApi(db, 'manager', () => one(db, 'select public.refresh_alerts() as r'));
    const ids = (await inbox('manager')).filter((n) => n.event === 'payment_overdue').map((n) => Number(n.record_id));
    expect(ids).not.toContain(paidUp);
    expect(ids).not.toContain(notDue);
  });
});
