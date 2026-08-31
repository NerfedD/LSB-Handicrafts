/**
 * Supabase-backed data manager for LSB Handicrafts Admin System.
 *
 * Replaces the old localStorage persistence. The app keeps owning its
 * in-memory arrays (inventory/deliveries/orders/activityLog) exactly as
 * before — these functions just load them from Supabase on startup and
 * push a reconciled copy (upsert changed rows, delete removed ones) back up
 * whenever they change, so components didn't need to be rewritten around a
 * per-action CRUD API.
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

const deliveryToRow = (d) => ({
  id: d.id,
  product: d.product,
  size: d.size,
  location: d.location,
  amount: d.amount === '' || d.amount === undefined ? null : Number(d.amount),
  status: d.status,
  created_at: d.createdAt,
});

const deliveryFromRow = (r) => ({
  id: r.id,
  product: r.product,
  size: r.size,
  location: r.location,
  amount: r.amount,
  status: r.status,
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
const staffToRow = (s) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  contact_number: s.contactNumber,
  status: s.status,
  email: s.email || null,
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
});

const customerToRow = (c) => ({
  id: c.id,
  name: c.name,
  contact_number: c.contactNumber,
  email: c.email || null,
  address: c.address,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

const customerFromRow = (r) => ({
  id: r.id,
  name: r.name,
  contactNumber: r.contact_number,
  email: r.email,
  address: r.address,
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

// ---- generic load/sync helpers --------------------------------------------

/**
 * Reads a table. Returns { ok, data } rather than a bare array so callers can
 * tell "the table is legitimately empty" apart from "the read failed" — they
 * look identical otherwise, and a caller that treats a failed read as real
 * state will happily sync that emptiness back and delete the table. See the
 * isDataLoaded / isStaffLoaded guards in AdminDashboard.jsx and App.jsx.
 */
const loadTable = async (table, defaultData, fromRow = identity) => {
  try {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true });
    if (error) throw error;
    const rows = !data || data.length === 0 ? defaultData : data.map(fromRow);
    return { ok: true, data: rows };
  } catch (error) {
    console.error(`Failed to load ${table} from Supabase:`, error);
    return { ok: false, data: defaultData };
  }
};

/**
 * Reconciles a table with the given array: upserts every row, then deletes
 * whatever's left in the table that isn't in the array anymore.
 */
const syncTable = async (table, rows, toRow = identity) => {
  try {
    const { data: existing, error: fetchError } = await supabase.from(table).select('id');
    if (fetchError) throw fetchError;

    const existingIds = new Set((existing || []).map((r) => r.id));

    // Independent backstop against wiping a table. Emptying every row is
    // never something the UI asks for, so an empty array here means state was
    // lost (a failed load, a bad render) rather than a real deletion.
    if (rows.length === 0 && existingIds.size > 0) {
      console.warn(
        `Refusing to clear ${table}: in-memory state is empty but the table has ${existingIds.size} row(s).`
      );
      return false;
    }

    const currentIds = new Set(rows.map((r) => r.id));
    const idsToDelete = [...existingIds].filter((id) => !currentIds.has(id));

    // The same backstop, for the case the empty check above misses: state that
    // was mostly lost rather than entirely lost. A read that comes back empty
    // because RLS denied it, followed by the app appending a single row, gives
    // an array of one that would otherwise delete every other row in the table
    // — which is exactly how the staff table got wiped once.
    //
    // Deletions in this UI are one row at a time, so removing most of a table
    // in a single sync is not something the screens can legitimately ask for.
    // The >2 floor keeps small tables editable (clearing 2 of 3 rows is fine).
    if (idsToDelete.length > 2 && idsToDelete.length > existingIds.size / 2) {
      console.warn(
        `Refusing to sync ${table}: it would delete ${idsToDelete.length} of ` +
          `${existingIds.size} row(s), leaving ${rows.length}. That looks like ` +
          `lost state rather than an edit.`
      );
      return false;
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from(table).delete().in('id', idsToDelete);
      if (deleteError) throw deleteError;
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from(table).upsert(rows.map(toRow), { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }

    return true;
  } catch (error) {
    console.error(`Failed to save ${table} to Supabase:`, error);
    return false;
  }
};

// ---- inventory --------------------------------------------------------

export const loadInventory = (defaultInventory = []) =>
  loadTable('inventory', defaultInventory, inventoryFromRow);
export const saveInventory = (inventoryData) =>
  syncTable('inventory', inventoryData, inventoryToRow);

export const deleteFromInventory = (inventoryData, itemId) =>
  inventoryData.filter((item) => item.id !== itemId);

// ---- deliveries ---------------------------------------------------------

export const loadDeliveries = (defaultDeliveries = []) =>
  loadTable('deliveries', defaultDeliveries, deliveryFromRow);
export const saveDeliveries = (deliveriesData) => syncTable('deliveries', deliveriesData, deliveryToRow);

export const deleteFromDeliveries = (deliveriesData, deliveryId) =>
  deliveriesData.filter((delivery) => delivery.id !== deliveryId);

// ---- orders ---------------------------------------------------------------

export const loadOrders = (defaultOrders = []) => loadTable('orders', defaultOrders, orderFromRow);
export const saveOrders = (ordersData) => syncTable('orders', ordersData, orderToRow);

export const deleteFromOrders = (ordersData, orderId) =>
  ordersData.filter((order) => order.id !== orderId);

// ---- activity log -----------------------------------------------------

export const loadActivityLog = (defaultActivity = []) => loadTable('activity_log', defaultActivity);
export const saveActivityLog = (activityData) => syncTable('activity_log', activityData);

// ---- staff / user accounts ---------------------------------------------

export const loadStaff = (defaultStaff = []) => loadTable('staff', defaultStaff, staffFromRow);
export const saveStaff = (staffData) => syncTable('staff', staffData, staffToRow);

// ---- customer / product / supplier profiles ----------------------------
// Figma screens #14-#22. Same whole-table load + reconciling sync as
// everything above; see useSupabaseCollection for the wiring on the app side.

export const loadCustomers = (defaultCustomers = []) =>
  loadTable('customers', defaultCustomers, customerFromRow);
export const saveCustomers = (customerData) =>
  syncTable('customers', customerData, customerToRow);

export const loadProducts = (defaultProducts = []) =>
  loadTable('products', defaultProducts, productFromRow);
export const saveProducts = (productData) =>
  syncTable('products', productData, productToRow);

export const loadSuppliers = (defaultSuppliers = []) =>
  loadTable('suppliers', defaultSuppliers, supplierFromRow);
export const saveSuppliers = (supplierData) =>
  syncTable('suppliers', supplierData, supplierToRow);

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
