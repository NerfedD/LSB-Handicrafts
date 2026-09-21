import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }));
import { customersCollection, suppliersCollection, productsCollection, inventoryCollection } from './storageManager';

for (const collection of [customersCollection, suppliersCollection, productsCollection, inventoryCollection]) {
  it(`BUG-001: ${collection.table} rejects a stale save and preserves the newer record`, async () => {
    let stored = { id: 901, revision: 3, name: 'Original', contact_number: '09171234567', address: 'Old address' };
    const original = collection.fromRow(stored);
    from.mockImplementation(() => {
      let payload;
      const filters = [];
      const query = {
        update: (next) => { payload = next; return query; },
        eq: (field, value) => { filters.push([field, value]); return query; },
        select: () => query,
        maybeSingle: async () => {
          if (!filters.every(([key, value]) => stored[key] === value)) return { data: null, error: null };
          stored = { ...stored, ...payload, revision: stored.revision + 1 };
          return { data: stored, error: null };
        },
      };
      return query;
    });
    expect((await collection.update(901, { ...original, name: 'Newer name' })).ok).toBe(true);
    const result = await collection.update(901, { ...original, name: 'Stale name' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/changed.*refresh/i);
    expect(stored.name).toBe('Newer name');
    expect(stored.revision).toBe(4);
  });
}

let db;
const migration = readFileSync(new URL('../../supabase/migrations/20260921122520_qa_integrity_guards.sql', import.meta.url), 'utf8');
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select '{"email":"qa-sales@example.test","sub":"00000000-0000-4000-8000-000000000001","session_id":"00000000-0000-4000-8000-000000000002"}'::jsonb;
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.staff(id bigint primary key, name text, email text, status text);
    insert into public.staff values (1, 'Actual staff member', 'qa-sales@example.test', 'Active');
    create table public.customers(id bigint primary key, name text);
    create table public.suppliers(id bigint primary key, name text);
    create table public.products(id bigint primary key, name text, item_code text);
    create table public.inventory(id bigint primary key, name text, sku text, stock integer);
    create table public.orders(id bigint primary key, total_amount numeric);
    create table public.deliveries(id bigint primary key, status text);
    create table public.activity_log(id bigint generated always as identity primary key,
      type text, staff_name text, description text, subject text, amount numeric, at timestamptz);
    insert into public.activity_log(type, staff_name, description) values ('account', 'Legacy actor', 'old entry');
    alter table public.activity_log enable row level security;
    create policy "Active staff insert activity_log" on public.activity_log for insert with check (true);
    grant all on public.activity_log to authenticated;
    grant select, insert, update, delete on public.customers to authenticated;
  `);
  await db.exec(migration);
});
afterAll(async () => { await db?.close(); });

it('BUG-002: direct forged audit insert is denied even if the role used to have write grants', async () => {
  await db.exec('set role authenticated');
  try {
    await expect(db.exec(`insert into public.activity_log(type, staff_name, description, at, source)
      values ('account', 'Impersonated administrator', 'fabricated event', '2020-01-01', 'server')`)).rejects.toThrow(/permission denied/i);
  } finally { await db.exec('reset role'); }
});

it('BUG-002: an actual write creates its audit event with server-derived actor and time', async () => {
  await db.exec(`set role authenticated; insert into public.customers values (11, 'QA customer', 0); reset role;`);
  const { rows } = await db.query(`select * from public.activity_log where subject = 'customer:11'`);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ staff_name: 'Actual staff member', actor_staff_id: 1, source: 'server', description: 'added customer QA customer' });
  expect(new Date(rows[0].at).getTime()).toBeGreaterThan(Date.now() - 60_000);
});

it('BUG-001: actual SQL revision trigger and conditional update reject the stale snapshot', async () => {
  await db.exec(`insert into public.customers(id, name) values (12, 'Original');
    update public.customers set name = 'Newer' where id = 12 and revision = 0;`);
  const stale = await db.query(`update public.customers set name = 'Stale' where id = 12 and revision = 0 returning *`);
  expect(stale.rows).toHaveLength(0);
  expect((await db.query('select name, revision from public.customers where id = 12')).rows).toEqual([{ name: 'Newer', revision: 1 }]);
});

it('BUG-002: rollback removes both the business write and its audit event', async () => {
  await db.exec(`begin; insert into public.customers(id, name) values (13, 'Rolled back'); rollback;`);
  expect((await db.query(`select * from public.activity_log where subject = 'customer:13'`)).rows).toHaveLength(0);
  expect((await db.query('select * from public.customers where id = 13')).rows).toHaveLength(0);
});

it('BUG-002: sign-in RPC records only the authenticated actor, once per session', async () => {
  await db.exec(`set role authenticated; select public.record_session_activity(); select public.record_session_activity(); reset role;`);
  const { rows } = await db.query(`select staff_name, source from public.activity_log where type = 'sign-in'`);
  expect(rows).toEqual([{ staff_name: 'Actual staff member', source: 'server' }]);
});

it('BUG-002: historical events remain unverified and migration can be reapplied', async () => {
  await db.exec(migration);
  expect((await db.query(`select source from public.activity_log where description = 'old entry'`)).rows).toEqual([{ source: 'legacy' }]);
  const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
  expect(schema.replaceAll('\r\n', '\n')).toContain(migration.replaceAll('\r\n', '\n').trim());
});

it('BUG-002: clients cannot edit/delete audit events or execute the private audit trigger', async () => {
  await db.exec('set role authenticated');
  try {
    await expect(db.exec(`update public.activity_log set staff_name = 'Forged'`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec('delete from public.activity_log')).rejects.toThrow(/permission denied/i);
    expect((await db.query(`select has_function_privilege('authenticated', 'private.audit_record_change()', 'EXECUTE') as allowed`)).rows[0].allowed).toBe(false);
  } finally { await db.exec('reset role'); }
});

it('BUG-002: anonymous and blocked staff cannot record a session event', async () => {
  await db.exec('set role anon');
  try {
    await expect(db.exec('select public.record_session_activity()')).rejects.toThrow(/permission denied/i);
  } finally { await db.exec('reset role'); }
  await db.exec(`update public.staff set status = 'Blocked' where id = 1; set role authenticated;`);
  try {
    await expect(db.exec('select public.record_session_activity()')).rejects.toThrow(/active staff session/i);
  } finally {
    await db.exec(`reset role; update public.staff set status = 'Active' where id = 1;`);
  }
});
