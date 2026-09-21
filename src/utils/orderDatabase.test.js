import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { commitOrder, commitPartialDelivery, handleRefundStock, uncommitOrder } from './stockLedger';

// Real PostgreSQL functions and triggers, with isolated tables and JWT helpers.
// PGlite has one connection: these tests prove stale-snapshot rejection and
// rollback, not contention between independent PostgreSQL connections.
let db;
const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const line = (quantity = 4, productId = 101) => ({ productId, name: 'Sheets', quantity, stockUnits: quantity, unitPrice: 150, kind: 'catalog' });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt() ->> 'sub')::uuid;
    $$;
    create table public.staff (id bigint primary key, email text, role text, status text);
    create table public.customers (id bigint primary key, name text);
    create table public.inventory (id bigint primary key, stock integer not null);
    create table public.orders (id bigint primary key, customer_name text, items jsonb not null,
      status text default 'Pending', total_amount numeric default 600, stock_committed_at timestamptz,
      refunded_amount numeric not null default 0, refund_history jsonb not null default '[]',
      price_adjustments jsonb not null default '[]', backorder_status text default 'none');
    create table public.deliveries (id bigint primary key, product text, status text,
      driver text, items_manifest jsonb default '[]');
    create function private.is_manager_or_admin() returns boolean language sql stable as $$
      select exists (select 1 from public.staff where email = auth.jwt() ->> 'email'
        and role in ('Admin', 'Manager') and status = 'Active');
    $$;
  `);
  for (const name of ['202609190002_orders_guard_contents', '202609190003_order_command',
    '202609190004_orders_customer_id', '20260919135654_order_command_safety']) {
    await db.exec(migration(name));
  }
}, 30_000);

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`truncate public.orders, public.inventory, public.deliveries, public.staff, private.order_requests;
    insert into public.staff values (1, 'admin@test.invalid', 'Admin', 'Active'), (2, 'sales@test.invalid', 'Sales Staff', 'Active');
    insert into public.inventory values (101, 64), (102, 20);
    insert into public.deliveries values (11, 'Order #1 - Test', 'Ready To Go', null, '[]'),
      (12, 'Order #2 - Test', 'Ready To Go', null, '[]');`);
  await db.query("insert into public.orders(id, customer_name, items) values (1, 'Test', $1), (2, 'Test', $2)",
    [JSON.stringify([line()]), JSON.stringify([line(8)])]);
  await actor('admin');
});

async function actor(name) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({
    sub: '00000000-0000-4000-8000-000000000001', email: `${name}@test.invalid`,
  })]);
}

async function order(id = 1) {
  const { rows: [row] } = await db.query('select * from public.orders where id = $1', [id]);
  return { id: row.id, revision: row.revision, items: row.items, status: row.status,
    stockCommittedAt: row.stock_committed_at, refundedAmount: Number(row.refunded_amount), refundHistory: row.refund_history };
}

async function stocks() {
  return (await db.query('select stock from public.inventory order by id')).rows.map((row) => row.stock);
}

async function command(action, data, requestId = crypto.randomUUID()) {
  const result = await db.query('select public.order_command($1, $2, $3) as result', [action, JSON.stringify(data), requestId]);
  return result.rows[0].result;
}

function complete(source) {
  const moved = commitOrder([], source);
  return { orderId: source.id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, stockCommittedAt: moved.stockCommittedAt, status: 'Completed' } };
}

function refund(source, amount = 150) {
  const moved = handleRefundStock([], source, [{ lineIndex: 0, units: 1, disposition: 'restock' }]);
  return { orderId: source.id, expectedRevision: source.revision, deltas: moved.deltas,
    order: { items: moved.items, refundedAmount: source.refundedAmount + amount,
      refundHistory: [...source.refundHistory, { id: crypto.randomUUID(), amount }] } };
}

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
    expect((await db.query('select * from private.order_requests')).rows).toHaveLength(0);
  });

  it('rolls back stock and order when stock would become negative', async () => {
    await db.exec('update public.inventory set stock = 2 where id = 101');
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
    await db.exec("update public.orders set status = 'Cancelled' where id = 1");
    await expect(command('dispatch', { orderId: 1, deliveryId: 11, expectedRevision: 1, expectedDeliveryRevision: 0,
      order: {}, delivery: { status: 'On The Way' } })).rejects.toThrow(/called off/);
    expect(await stocks()).toEqual([64, 20]);
  });

  it('rejects a delivery belonging to another order', async () => {
    await expect(command('dispatch', { orderId: 1, deliveryId: 12, expectedRevision: 0, expectedDeliveryRevision: 0 }))
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

describe('manager-only changes', () => {
  it.each(['name', 'notes', 'stockUnits', 'lineTotal', 'kind'])('guards the %s field against direct staff updates', async (field) => {
    const items = [line()];
    items[0][field] = ['stockUnits', 'lineTotal'].includes(field) ? 999 : 'changed';
    await actor('sales');
    await expect(db.query('update public.orders set items = $1 where id = 1', [JSON.stringify(items)]))
      .rejects.toThrow(/administrator or a manager/);
  });

  it('permits staff to complete without changing the agreed lines', async () => {
    await actor('sales');
    await command('complete', complete(await order()));
    expect(await stocks()).toEqual([60, 20]);
  });

  it('refuses staff cancellation through the command', async () => {
    await actor('sales');
    await expect(command('cancel', { orderId: 1, expectedRevision: 0, order: { status: 'Cancelled' } }))
      .rejects.toThrow(/administrator or a manager/);
  });
});
