// Role boundaries and loyalty rules as the database enforces them, whatever the
// screens show. Real schema in PGlite; every call runs as the `authenticated`
// API role so row level security applies (see src/test/database.js).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { all, asApi, freshDatabase, one, signIn } from '../test/database';

let db;
let next = 500;
const uid = () => (next += 1);

beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await signIn(db, null); });

async function customer(name = `Customer ${uid()}`) {
  const id = uid();
  await db.query(`insert into public.customers (id, name, contact_number) values ($1, $2, '0917 555 0101')`, [id, name]);
  return { id, name };
}

async function order({ customerId = null, name = 'Walk-in', status = 'Pending', items = [] } = {}) {
  const id = uid();
  await db.query(`insert into public.orders (id, customer_name, customer_id, items, total_amount, status)
    values ($1, $2, $3, $4, 1000, $5)`, [id, name, customerId, JSON.stringify(items), status]);
  return id;
}

describe('customer information', () => {
  it('is readable by sales, delivery, managers and admins, and not by production', async () => {
    await customer();
    for (const who of ['admin', 'manager', 'sales', 'delivery']) {
      const rows = await asApi(db, who, () => all(db, 'select id from public.customers'));
      expect(rows.length, who).toBeGreaterThan(0);
    }
    expect(await asApi(db, 'production', () => all(db, 'select id from public.customers'))).toEqual([]);
  });

  it('is added and edited by the selling roles only', async () => {
    await asApi(db, 'sales', () => db.query(`insert into public.customers (name) values ('New walk-in')`));
    await asApi(db, 'delivery', async () => {
      await expect(db.query(`insert into public.customers (name) values ('Not allowed')`)).rejects.toThrow(/row-level security/);
    });
  });

  it('cannot be removed while an order for them is waiting, by id or by name', async () => {
    const linked = await customer();
    await order({ customerId: linked.id, name: linked.name });
    const named = await customer('Rosa Fernandez');
    await order({ name: ' rosa fernandez ' });
    for (const target of [linked, named]) {
      await asApi(db, 'admin', async () => {
        await expect(db.query('delete from public.customers where id = $1', [target.id])).rejects.toThrow(/still has an order waiting/);
      });
    }
  });

  it('keeps past orders, with their name, when a customer without open orders is removed', async () => {
    const gone = await customer();
    const orderId = await order({ customerId: gone.id, name: gone.name, status: 'Completed' });
    await asApi(db, 'admin', () => db.query('delete from public.customers where id = $1', [gone.id]));
    expect(await one(db, 'select customer_id, customer_name from public.orders where id = $1', [orderId]))
      .toEqual({ customer_id: null, customer_name: gone.name });
  });
});

describe('management records', () => {
  it('lets only managers and admins add or change suppliers', async () => {
    const id = uid();
    await db.query(`insert into public.suppliers (id, name) values ($1, 'Davao Foam')`, [id]);
    for (const who of ['sales', 'production', 'delivery']) {
      await asApi(db, who, () => db.query(`update public.suppliers set name = 'Changed' where id = $1`, [id]));
      await asApi(db, who, async () => {
        await expect(db.query(`insert into public.suppliers (name) values ('Nope')`)).rejects.toThrow(/row-level security/);
      });
    }
    expect((await one(db, 'select name from public.suppliers where id = $1', [id])).name).toBe('Davao Foam');
    await asApi(db, 'manager', () => db.query(`update public.suppliers set name = 'Davao Foam Supply' where id = $1`, [id]));
    expect((await one(db, 'select name from public.suppliers where id = $1', [id])).name).toBe('Davao Foam Supply');
  });

  it('lets only managers and admins change a product or its price', async () => {
    const id = uid();
    await db.query(`insert into public.products (id, item_code, name, unit_price) values ($1, $2, 'Ball', 100)`, [id, `B-${id}`]);
    await asApi(db, 'sales', () => db.query('update public.products set unit_price = 1 where id = $1', [id]));
    expect(Number((await one(db, 'select unit_price from public.products where id = $1', [id])).unit_price)).toBe(100);
    await asApi(db, 'manager', () => db.query('update public.products set unit_price = 120 where id = $1', [id]));
    expect(Number((await one(db, 'select unit_price from public.products where id = $1', [id])).unit_price)).toBe(120);
  });

  it('lets managers take an unsent delivery off the board, and keeps one that went out', async () => {
    const orderId = await order();
    const unsent = uid();
    const sent = uid();
    await db.query(`insert into public.deliveries (id, product, location, status, order_id) values
      ($1, 'Order #x', 'Davao', 'Ready To Go', $3), ($2, 'Order #y', 'Davao', 'Delivered', $3)`, [unsent, sent, orderId]);
    await asApi(db, 'sales', () => db.query('delete from public.deliveries where id = $1', [unsent]));
    await asApi(db, 'manager', () => db.query('delete from public.deliveries where id in ($1, $2)', [unsent, sent]));
    expect((await all(db, 'select id from public.deliveries where order_id = $1', [orderId])).map((r) => r.id)).toEqual([sent]);
  });
});

describe('loyalty', () => {
  const rules = (changes) => asApi(db, 'manager', () => db.query(
    `update public.loyalty_rules set ${Object.keys(changes).map((key, i) => `${key} = $${i + 1}`).join(', ')} where id = 1`,
    Object.values(changes)));

  async function orderWithDiscount(who, target, discount, subtotal = 1000) {
    const items = [{ name: 'Centrepiece', quantity: 1, unitPrice: subtotal, lineTotal: subtotal, kind: 'custom' }];
    return asApi(db, who, () => db.query(`insert into public.orders (customer_name, customer_id, items, total_amount, discount_amount, promotion)
      values ($1, $2, $3, $4, $5, '{"kind": "loyalty", "percent": 99}') returning id, promotion`,
      [target.name, target.id, JSON.stringify(items), subtotal - discount, discount]));
  }

  it('starts switched off, and only managers and admins may change the rules', async () => {
    expect(await one(db, 'select enabled, regular_after_orders, reward_after_orders, reward_percent from public.loyalty_rules'))
      .toEqual({ enabled: false, regular_after_orders: 3, reward_after_orders: 5, reward_percent: '5.00' });
    await asApi(db, 'sales', () => db.query('update public.loyalty_rules set enabled = true'));
    expect((await one(db, 'select enabled from public.loyalty_rules')).enabled).toBe(false);
    await rules({ enabled: true, reward_after_orders: 2, reward_percent: 10 });
    expect(await one(db, 'select enabled, updated_by from public.loyalty_rules')).toEqual({ enabled: true, updated_by: 'manager person' });
  });

  it('gives the reward only to a customer who has earned it, counting orders found by id or by name', async () => {
    await rules({ enabled: true, reward_after_orders: 2, reward_percent: 10 });
    const regular = await customer('Liza Villanueva');
    await expect(orderWithDiscount('sales', regular, 100)).rejects.toThrow(/has 0 finished orders; the loyalty reward starts at 2/);
    await order({ customerId: regular.id, name: regular.name, status: 'Completed' });
    await order({ name: 'LIZA VILLANUEVA', status: 'Completed' });
    await order({ customerId: regular.id, name: regular.name, status: 'Cancelled' });
    const { rows: [saved] } = await orderWithDiscount('sales', regular, 100);
    // The browser's claim of 99 percent is replaced by the rule that applied.
    expect(saved.promotion).toMatchObject({ kind: 'loyalty', percent: 10, finishedOrders: 2 });
  });

  it('never allows more than the configured percentage, or a discount that is not the reward', async () => {
    await rules({ enabled: true, reward_after_orders: 1, reward_percent: 10 });
    const regular = await customer();
    await order({ customerId: regular.id, name: regular.name, status: 'Completed' });
    await expect(orderWithDiscount('sales', regular, 100.01)).rejects.toThrow(/at most 100.00/);
    await expect(asApi(db, 'sales', () => db.query(`insert into public.orders (customer_name, customer_id, items, discount_amount, promotion)
      values ($1, $2, '[]', 5, '{"kind": "staff-deal"}')`, [regular.name, regular.id]))).rejects.toThrow(/Only the loyalty reward/);
  });

  it('refuses a reward while the rules are switched off', async () => {
    await rules({ enabled: false });
    const regular = await customer();
    await expect(orderWithDiscount('manager', regular, 10)).rejects.toThrow(/switched off/);
  });

  it('summarises each customer\'s whole history without the browser loading it', async () => {
    const regular = await customer('Carlos Mendoza');
    await order({ customerId: regular.id, name: regular.name, status: 'Completed' });
    await order({ customerId: regular.id, name: regular.name, status: 'Pending' });
    await order({ customerId: regular.id, name: regular.name, status: 'Cancelled' });
    const stats = await asApi(db, 'sales', () => one(db,
      'select order_count, completed_count, open_count, spent from public.customer_order_stats where customer_key = $1', [`id:${regular.id}`]));
    expect(stats).toEqual({ order_count: 2, completed_count: 1, open_count: 1, spent: '2000' });
  });
});
