/**
 * The data layer: one Supabase table per collection, and one row per write.
 *
 * WHAT IT REPLACED, TWICE OVER. First localStorage, then a whole-table
 * reconcile that upserted every row and deleted anything missing from the
 * in-memory array — which is what destroyed data during class testing, because
 * a read denied by RLS is indistinguishable from an empty table. That path is
 * gone entirely (see the note where it used to live, below the write helpers).
 *
 * Everything now goes through createRow / updateRow / deleteRow: one row,
 * awaited, with the result checked and reported. A rejected write is visible on
 * screen rather than a console.error nobody sees under a green success panel.
 */
import { supabase } from '../lib/supabaseClient';

// ---- row <-> app-object mapping -------------------------------------------
// activity_log columns already match the JS shape 1:1. Every other table needs
// camelCase <-> snake_case translation.
//
// These mappers enumerate their keys by hand, which means a field missing from
// one is dropped silently — on read AND on write. Whenever a column is added to
// schema.sql, both directions here have to gain it too.

/**
 * Numeric columns that are nullable in Postgres. An empty form field arrives
 * here as '', which PostgREST rejects for a numeric column — and syncTable only
 * console.errors that rejection, so the whole table's write is lost with nothing
 * on screen to show for it. Send an explicit null instead.
 */
const numOrNull = (v) =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v))
    ? null
    : Number(v);

/**
 * Integer columns that are NOT NULL with a default in Postgres. The fallback
 * passed here must match that column's SQL default exactly: syncTable upserts
 * whole rows, so a mismatch quietly overwrites real values with the wrong
 * number on the next save.
 */
const intOr = (v, fallback) =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v))
    ? fallback
    : Math.trunc(Number(v));

/**
 * Inventory is the styro catalog: one row per size. `productType` decides which
 * dimension fields are meaningful — a ball has a diameter and no length/width,
 * a sheet has thickness/length/width and no diameter — so the unused ones go to
 * the database as null rather than 0.
 *
 * `stock` and `reserved` count SELLING units, not pieces: a sheet sold by the
 * bundle stores 25 to mean 25 bundles. `packSize` is what turns that back into
 * pieces for display.
 */
const inventoryToRow = (i) => ({
  id: i.id,
  sku: i.sku,
  name: i.name,
  category: i.category,
  price: numOrNull(i.price) ?? 0,
  stock: intOr(i.stock, 0),
  max_stock: intOr(i.maxStock, 0),
  status: i.status || 'In Stock',
  product_type: i.productType || 'other',
  diameter_in: numOrNull(i.diameterIn),
  thickness_in: numOrNull(i.thicknessIn),
  length_ft: numOrNull(i.lengthFt),
  width_ft: numOrNull(i.widthFt),
  unit: i.unit || 'piece',
  pack_size: intOr(i.packSize, 1),
  low_stock_threshold: intOr(i.lowStockThreshold, 50),
  reserved: intOr(i.reserved, 0),
  is_cuttable: !!i.isCuttable,
});

const inventoryFromRow = (r) => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  category: r.category,
  price: r.price,
  stock: r.stock,
  maxStock: r.max_stock,
  status: r.status,
  productType: r.product_type,
  diameterIn: r.diameter_in,
  thicknessIn: r.thickness_in,
  lengthFt: r.length_ft,
  widthFt: r.width_ft,
  unit: r.unit,
  packSize: r.pack_size,
  lowStockThreshold: r.low_stock_threshold,
  reserved: r.reserved,
  isCuttable: r.is_cuttable,
});

// `driver` is free text and nullable: a delivery with nobody assigned yet is a
// real state the board has a column for, so an empty string goes up as null
// rather than as "", which would count as assigned.
const deliveryToRow = (d) => ({
  id: d.id,
  product: d.product,
  size: d.size,
  location: d.location,
  amount: d.amount === '' || d.amount === undefined ? null : Number(d.amount),
  status: d.status,
  driver: d.driver?.trim() || null,
  // A `date` column: '' from an untouched form field is not a date and
  // PostgREST rejects it, taking the whole write with it.
  due_on: d.dueOn || null,
  created_at: d.createdAt,
});

const deliveryFromRow = (r) => ({
  id: r.id,
  product: r.product,
  size: r.size,
  location: r.location,
  amount: r.amount,
  status: r.status,
  driver: r.driver,
  dueOn: r.due_on,
  createdAt: r.created_at,
});

// `items` is untyped jsonb, so line-item shape changes need no migration here —
// but a new top-level order field does. stockCommittedAt is stamped when a
// Pending order is marked Completed and its stock is actually deducted; its
// presence is what keeps that deduction from happening twice.
const orderToRow = (o) => ({
  id: o.id,
  customer_name: o.customerName,
  items: o.items || [],
  total_amount: o.totalAmount,
  status: o.status,
  created_at: o.createdAt,
  stock_committed_at: o.stockCommittedAt || null,
});

const orderFromRow = (r) => ({
  id: r.id,
  customerName: r.customer_name,
  items: r.items || [],
  totalAmount: r.total_amount,
  status: r.status,
  createdAt: r.created_at,
  stockCommittedAt: r.stock_committed_at,
});

// `username` is nullable and uniquely indexed (case-insensitively), so an empty
// form field has to go up as null rather than '' — otherwise the second account
// saved without a username collides with the first.
//
// `email` goes up lowercased. Supabase Auth stores and returns emails in lower
// case, and the RLS predicates match on lower(email); a row saved as
// 'FinalTest@gmail.com' used to never match its own JWT, which locked that
// account out of the entire app.
//
// `is_super_admin` is read but deliberately NOT written: staffToRow feeds
// inserts and updates, and the database refuses to let anyone but a superadmin
// set that flag. Leaving it out keeps the client from ever sending a value the
// server would reject.
const staffToRow = (s) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  contact_number: s.contactNumber,
  status: s.status,
  email: s.email ? s.email.trim().toLowerCase() : null,
  username: s.username?.trim() || null,
});

const staffFromRow = (r) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  contactNumber: r.contact_number,
  status: r.status,
  email: r.email,
  username: r.username,
  isSuperAdmin: !!r.is_super_admin,
  // Which of the two dashboards this person sees. Read but deliberately NOT
  // written by staffToRow, for the same reason as is_super_admin: that mapper
  // feeds every admin insert and update, and one person's view preference is
  // not something another person's edit should be able to overwrite. It is
  // changed only through set_own_dashboard_view() below.
  dashboardView: r.dashboard_view || 'standard',
});

/**
 * The activity feed's rows.
 *
 * `staff_name`, `subject` and `at` are the columns the UI overhaul added (see
 * supabase/schema.sql). The four original ones are still mapped because rows
 * written by the legacy workspace screens carry them, and utils/activityLog.js
 * falls back to `title`/`date` when the new columns are null — otherwise every
 * pre-existing entry would render as a blank line.
 */
const activityToRow = (a) => ({
  id: a.id,
  type: a.type,
  title: a.title ?? null,
  description: a.description ?? null,
  amount: numOrNull(a.amount),
  status: a.status ?? null,
  color: a.color ?? null,
  date: a.date ?? null,
  staff_name: a.staffName ?? null,
  subject: a.subject ?? null,
  at: a.at ?? new Date().toISOString(),
});

const activityFromRow = (r) => ({
  id: r.id,
  type: r.type,
  title: r.title,
  description: r.description,
  amount: r.amount,
  status: r.status,
  color: r.color,
  date: r.date,
  staffName: r.staff_name,
  subject: r.subject,
  at: r.at,
});

// `kind` is 'business' | 'walk-in' and is NOT NULL with a default, so an
// unanswered form field has to fall back to that default rather than going up
// as null and being rejected.
const customerToRow = (c) => ({
  id: c.id,
  name: c.name,
  contact_number: c.contactNumber,
  email: c.email || null,
  address: c.address,
  kind: c.kind === 'business' ? 'business' : 'walk-in',
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

const customerFromRow = (r) => ({
  id: r.id,
  name: r.name,
  contactNumber: r.contact_number,
  email: r.email,
  address: r.address,
  kind: r.kind || 'walk-in',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// The catalog twin of `inventory`: same styro shape, no stock columns. `size`
// is no longer typed by hand — it's a label derived from the dimensions, kept
// as a column so anything already reading it keeps working.
const productToRow = (p) => ({
  id: p.id,
  item_code: p.itemCode,
  name: p.name,
  size: p.size,
  unit_price:
    p.unitPrice === '' || p.unitPrice === undefined ? null : Number(p.unitPrice),
  low_stock_threshold:
    p.lowStockThreshold === '' || p.lowStockThreshold === undefined
      ? null
      : Number(p.lowStockThreshold),
  status: p.status,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
  product_type: p.productType || 'other',
  diameter_in: numOrNull(p.diameterIn),
  thickness_in: numOrNull(p.thicknessIn),
  length_ft: numOrNull(p.lengthFt),
  width_ft: numOrNull(p.widthFt),
  unit: p.unit || 'piece',
  pack_size: intOr(p.packSize, 1),
});

const productFromRow = (r) => ({
  id: r.id,
  itemCode: r.item_code,
  name: r.name,
  size: r.size,
  unitPrice: r.unit_price,
  lowStockThreshold: r.low_stock_threshold,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  productType: r.product_type,
  diameterIn: r.diameter_in,
  thicknessIn: r.thickness_in,
  lengthFt: r.length_ft,
  widthFt: r.width_ft,
  unit: r.unit,
  packSize: r.pack_size,
});

const supplierToRow = (s) => ({
  id: s.id,
  name: s.name,
  contact_person: s.contactPerson,
  contact_number: s.contactNumber,
  email: s.email || null,
  address: s.address,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

const supplierFromRow = (r) => ({
  id: r.id,
  name: r.name,
  contactPerson: r.contact_person,
  contactNumber: r.contact_number,
  email: r.email,
  address: r.address,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const identity = (x) => x;

// ---- generic load/write helpers -------------------------------------------

/**
 * Reads a table. Returns { ok, data } rather than a bare array so callers can
 * tell "the table is legitimately empty" apart from "the read failed" — they
 * look identical otherwise, and a caller that treats a failed read as real
 * state used to sync that emptiness back and delete the table.
 */
const loadTable = async (table, defaultData, fromRow = identity) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    const rows = !data || data.length === 0 ? defaultData : data.map(fromRow);
    return { ok: true, data: rows };
  } catch (error) {
    console.error(`Failed to load ${table} from Supabase:`, error);
    return { ok: false, data: defaultData, error };
  }
};

/**
 * Turns anything Supabase hands back into a message worth showing a user.
 *
 * Postgres constraint names leak through verbatim otherwise — "new row for
 * relation \"staff\" violates check constraint \"staff_role_check\"" is not a
 * sentence anyone should read on screen.
 */
const humanizeError = (error, fallback) => {
  if (!error) return fallback;
  const raw = error.message || String(error);

  if (error.code === '23505' || /duplicate key/i.test(raw)) {
    if (/email/i.test(raw)) return 'That email address is already in use.';
    if (/username/i.test(raw)) return 'That username is already taken.';
    if (/item_code/i.test(raw)) return 'That item code is already in use.';
    return 'That record already exists.';
  }
  if (error.code === '23514' || /check constraint/i.test(raw)) {
    if (/role/i.test(raw)) return 'That is not a valid role.';
    if (/status/i.test(raw)) return 'That is not a valid status.';
    if (/contact_number/i.test(raw)) return 'That contact number is too long.';
    if (/price|amount/i.test(raw)) return 'That amount is outside the allowed range.';
    return 'One of the values is outside the allowed range.';
  }
  if (error.code === '22003' || /out of range/i.test(raw)) {
    return 'That number is too large.';
  }
  if (error.code === '42501' || /row-level security/i.test(raw)) {
    return 'You do not have permission to do that.';
  }
  // Raised by the staff guard trigger; already written for a human.
  if (/super administrator|Only an administrator/i.test(raw)) return raw;

  return fallback;
};

/**
 * Insert one row.
 *
 * Returns { ok, data, error } — never a bare boolean, and never swallowed. The
 * previous write path only console.error'd, so a rejected write still showed
 * the user a green "saved successfully" panel.
 */
const createRow = async (table, row, toRow = identity) => {
  const { data, error } = await supabase
    .from(table)
    .insert(toRow(row))
    .select()
    .maybeSingle();

  if (error) {
    console.error(`Failed to insert into ${table}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't save that ${table} record.`) };
  }
  // RLS can accept the statement and still return nothing if the new row is
  // outside the caller's SELECT policy.
  return { ok: true, data };
};

/**
 * Update one row by id.
 *
 * `patch` is a whole app-shaped object; `id` is never part of the payload, so a
 * mis-typed id can't silently repoint the row.
 */
const updateRow = async (table, id, patch, toRow = identity) => {
  const payload = toRow(patch);
  delete payload.id;

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(`Failed to update ${table} #${id}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't save your changes.`) };
  }
  // No error and no row means RLS filtered the row out of the UPDATE. Postgres
  // reports that as success with zero rows affected, so it has to be caught
  // here or the UI will claim a save that never happened.
  if (!data) {
    return {
      ok: false,
      message: "You do not have permission to change that record, or it no longer exists.",
    };
  }
  return { ok: true, data };
};

/**
 * Delete one row by id.
 *
 * Uses an exact count for the same reason updateRow checks for a returned row:
 * a DELETE blocked by RLS is not an error, it simply matches nothing. That is
 * exactly what happens when an ordinary admin tries to delete the superadmin,
 * and reporting it as success would put the UI back out of step with the
 * database — which is how a deleted-looking row kept reappearing on refresh.
 */
const deleteRow = async (table, id) => {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    console.error(`Failed to delete ${table} #${id}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't delete that record.`) };
  }
  if (!count) {
    return {
      ok: false,
      message: "You do not have permission to delete that record.",
    };
  }
  return { ok: true };
};

/**
 * A collection definition: everything the hook and the write helpers need to
 * talk to one table. Passing one of these around replaces the eight pairs of
 * load and save functions this module used to export.
 */
const collection = (table, fromRow = identity, toRow = identity) => ({
  table,
  fromRow,
  toRow,
  load: (defaultData = []) => loadTable(table, defaultData, fromRow),
  create: (row) => createRow(table, row, toRow),
  update: (id, patch) => updateRow(table, id, patch, toRow),
  remove: (id) => deleteRow(table, id),
});

export const inventoryCollection = collection('inventory', inventoryFromRow, inventoryToRow);
export const deliveriesCollection = collection('deliveries', deliveryFromRow, deliveryToRow);
export const ordersCollection = collection('orders', orderFromRow, orderToRow);
export const activityLogCollection = collection('activity_log', activityFromRow, activityToRow);
export const staffCollection = collection('staff', staffFromRow, staffToRow);
export const customersCollection = collection('customers', customerFromRow, customerToRow);
export const productsCollection = collection('products', productFromRow, productToRow);
export const suppliersCollection = collection('suppliers', supplierFromRow, supplierToRow);

export { createRow, updateRow, deleteRow, loadTable, humanizeError };

// ---- what used to live here -----------------------------------------------
//
// A block of whole-table load/save helpers and, at its centre, replaceAllRows()
// -- "upsert every row, then delete anything in the table that is not in this
// array". That function was the app's only write primitive and the root cause
// of the data loss during class testing: a read denied by RLS came back empty,
// the app appended one row to that emptiness, and the sync deleted every other
// row in the table.
//
// Two heuristic guards were bolted on to stop it, which in turn made legitimate
// bulk edits fail silently. It survived only because the unrouted legacy
// workspace still called it. The UI overhaul replaced those screens, so the
// last caller is gone and the function with it -- every write in this app is
// now one row, awaited, with its result checked (createRow / updateRow /
// deleteRow above).

// ---- the signed-in person's own profile -----------------------------------

/**
 * Saves the signed-in person's own name and contact number.
 *
 * Deliberately not a direct table write: RLS gates which ROWS you may write,
 * not which COLUMNS, so any policy permissive enough to let someone edit their
 * own row would also let them set their own role to 'Admin'. This RPC updates
 * exactly two columns on exactly the caller's row, decided server-side from
 * their token rather than from anything passed in here.
 */
export const saveOwnProfile = async ({ name, contactNumber }) => {
  const { error } = await supabase.rpc('update_own_profile', {
    p_name: name ?? '',
    p_contact_number: contactNumber ?? '',
  });
  if (error) {
    console.error('Failed to save your profile to Supabase:', error);
    return { ok: false, error, message: humanizeError(error, "Couldn't save your profile.") };
  }
  return { ok: true };
};

/**
 * Saves which dashboard the signed-in person wants to see.
 *
 * A separate RPC rather than two more parameters on update_own_profile, for the
 * reason spelled out beside it in schema.sql: that function is granted by exact
 * signature, so changing its arity would revoke the grant from any client still
 * calling the old shape.
 *
 * The preference is reachable from two places — the profile screen and the
 * header's account menu — because the handoff flags the profile screen alone as
 * possibly too buried for it.
 */
export const saveOwnDashboardView = async (view) => {
  const { error } = await supabase.rpc('set_own_dashboard_view', { p_view: view });
  if (error) {
    console.error('Failed to save your dashboard preference:', error);
    return {
      ok: false,
      error,
      message: humanizeError(error, "Couldn't save how your dashboard looks."),
    };
  }
  return { ok: true };
};

// ---- export / backup --------------------------------------------------

/**
 * Export the full admin workspace state as JSON (for a manual backup download).
 */
export const exportBackupData = ({ inventory = [], deliveries = [], orders = [] } = {}) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    counts: {
      inventory: inventory.length,
      deliveries: deliveries.length,
      orders: orders.length,
    },
    data: { inventory, deliveries, orders },
  };

  return JSON.stringify(exportData, null, 2);
};
