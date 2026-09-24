/**
 * A real PostgreSQL database for tests, built from the real supabase/schema.sql.
 *
 * PGlite runs Postgres in-process. The few things Supabase provides that the
 * schema relies on -- the API roles, auth.jwt()/auth.uid(), auth.users, and the
 * default grants on new tables -- are stubbed below with the same names, so the
 * policies, triggers and functions under test are the ones that ship.
 *
 * LIMITS: one connection, so lock contention between independent sessions is
 * not reproduced; and the JWT is whatever a test sets, not a signed token.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const readSql = (path) =>
  readFileSync(new URL(`../../supabase/${path}`, import.meta.url), 'utf8');

const SUPABASE_STUBS = `
  create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
    raw_app_meta_data jsonb default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

/** One staff member per role. Ids stay clear of the schema's bootstrap admin (id 1). */
export const STAFF = {
  admin: { id: 11, role: 'Admin' },
  manager: { id: 12, role: 'Manager' },
  sales: { id: 13, role: 'Sales Staff' },
  production: { id: 14, role: 'Production Staff' },
  delivery: { id: 15, role: 'Delivery Staff' },
};
export const emailOf = (who) => `${who}@lsb.test`;

export async function freshDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(readSql('schema.sql'));
  const rows = Object.entries(STAFF)
    .map(([who, { id, role }]) => `(${id}, '${who} person', '${role}', 'Active', '${emailOf(who)}')`)
    .join(', ');
  await db.exec(`insert into public.staff (id, name, role, status, email) values ${rows};`);
  return db;
}

/** Sets the signed-in person for the rest of the session (null signs out). */
export async function signIn(db, who) {
  const claims = who
    ? JSON.stringify({ sub: '00000000-0000-4000-8000-0000000000' + String(STAFF[who]?.id ?? 99).padStart(2, '0'),
        email: emailOf(who), role: 'authenticated' })
    : '';
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
}

/**
 * Runs `fn` as the `authenticated` API role, so row level security and grants
 * apply exactly as they do to a browser request.
 */
export async function asApi(db, who, fn) {
  await signIn(db, who);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

export const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
export const all = async (db, sql, params = []) => (await db.query(sql, params)).rows;

/** Calls one of the command RPCs the way the browser does. */
export async function rpc(db, name, action, data, requestId = crypto.randomUUID()) {
  const row = await one(db, `select public.${name}($1, $2, $3) as result`,
    [action, JSON.stringify(data), requestId]);
  return row.result;
}
