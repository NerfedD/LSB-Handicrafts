// schema.sql is the whole database: it must install on an empty project, be
// safe to run again on a live one, and carry every migration.
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { all, freshDatabase, readSql } from '../test/database';

let db;
beforeAll(async () => { db = await freshDatabase(); }, 60_000);
afterAll(async () => { await db?.close(); });

const lf = (text) => text.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)).trim();

it('installs on an empty database and can be run again over itself', async () => {
  await db.exec(readSql('schema.sql'));
  expect(await all(db, `select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('stock_movements', 'loyalty_rules') order by 1`))
    .toEqual([{ table_name: 'loyalty_rules' }, { table_name: 'stock_movements' }]);
});

it('seeds both halves of every starter product, and a re-run changes nothing', async () => {
  const seed = readSql('seed_inventory.sql');
  await db.exec(seed);
  const orphans = `select count(*)::int as n from public.inventory i
    where not exists (select 1 from public.products p where lower(p.item_code) = lower(i.sku))`;
  expect(await all(db, orphans)).toEqual([{ n: 0 }]);
  await db.exec(`update public.inventory set max_stock = 999 where id = 1`);
  await db.exec(seed);
  expect(await all(db, 'select max_stock from public.inventory where id = 1')).toEqual([{ max_stock: 999 }]);
  expect(await all(db, `select count(*)::int as n from public.stock_movements where kind = 'opening'`)).toEqual([{ n: 15 }]);
});

it('passes the purchasing and production acceptance script, and leaves nothing behind', async () => {
  const before = await all(db, 'select count(*)::int as n from public.raw_material_orders');
  // Its own assertions raise on failure; it ends in ROLLBACK.
  await db.exec(readSql('verify_production.sql'));
  expect(await all(db, 'select count(*)::int as n from public.raw_material_orders')).toEqual(before);
});

it('carries every migration, so a fresh install matches an upgraded one', () => {
  const schema = lf(readSql('schema.sql'));
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.sql'))) {
    // These two were folded into schema.sql by hand, reworded, before the
    // mirror convention existed; later migrations supersede both.
    if (['202609190001_record_id_sequence.sql', '202609190002_orders_guard_contents.sql'].includes(name)) continue;
    const body = lf(readSql(`migrations/${name}`)).replace(/^begin;\n/, '').replace(/\ncommit;$/, '').trim();
    expect(schema.includes(body), name).toBe(true);
  }
});
