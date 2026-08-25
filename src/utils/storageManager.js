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
// Inventory and activity_log columns already match the JS shape 1:1.
// Deliveries/orders need camelCase <-> snake_case translation.

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

const orderToRow = (o) => ({
  id: o.id,
  customer_name: o.customerName,
  items: o.items || [],
  total_amount: o.totalAmount,
  status: o.status,
  created_at: o.createdAt,
});

const orderFromRow = (r) => ({
  id: r.id,
  customerName: r.customer_name,
  items: r.items || [],
  totalAmount: r.total_amount,
  status: r.status,
  createdAt: r.created_at,
});

const staffToRow = (s) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  contact_number: s.contactNumber,
  status: s.status,
  email: s.email || null,
});

const staffFromRow = (r) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  contactNumber: r.contact_number,
  status: r.status,
  email: r.email,
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

export const loadInventory = (defaultInventory = []) => loadTable('inventory', defaultInventory);
export const saveInventory = (inventoryData) => syncTable('inventory', inventoryData);

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
