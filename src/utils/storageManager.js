/**
 * The data layer: one Supabase table per collection, and one row per write.
 *
 * Every write goes through createRow / updateRow / deleteRow: one row, awaited,
 * with the result checked and reported, so a rejected write is visible on
 * screen. Anything that moves stock or money is not a row write at all -- it is
 * a database command (see utils/commands.js).
 *
 * Reads are bounded. Open work is always loaded in full; history is loaded for
 * a recent window, and older records are fetched when somebody asks for them.
 */
import { supabase } from '../lib/supabaseClient';

// ---- row <-> app-object mapping -------------------------------------------
// These mappers enumerate their keys by hand, so a field missing from one is
// dropped silently -- on read AND on write. A column added to schema.sql has to
// be added in both directions here.

/** Nullable numeric columns: '' from an empty form field goes up as null. */
const numOrNull = (v) =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v);

/** NOT NULL integer columns: the fallback must match the column's SQL default. */
const intOr = (v, fallback) =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? fallback : Math.trunc(Number(v));

/**
 * The stock row for a catalogue product. `stock` counts SELLING units (a sheet
 * sold by the bundle stores 25 to mean 25 bundles); `packSize` turns that back
 * into pieces for display.
 *
 * `stock` is written only when the row is created (the opening count). After
 * that it moves only through recorded movements, and the database refuses a
 * direct write -- see stock_command in schema.sql.
 */
const inventoryToRow = (i) => ({
  id: i.id,
  sku: i.sku,
  name: i.name,
  category: i.category,
  price: numOrNull(i.price) ?? 0,
  stock: intOr(i.stock, 0),
  max_stock: intOr(i.maxStock, 0),
  product_type: i.productType || 'other',
  diameter_in: numOrNull(i.diameterIn),
  thickness_in: numOrNull(i.thicknessIn),
  length_ft: numOrNull(i.lengthFt),
  width_ft: numOrNull(i.widthFt),
  unit: i.unit || 'piece',
  pack_size: intOr(i.packSize, 1),
  low_stock_threshold: intOr(i.lowStockThreshold, 50),
  is_cuttable: !!i.isCuttable,
});

const inventoryFromRow = (r) => ({
  revision: r.revision ?? 0,
  id: r.id,
  sku: r.sku,
  name: r.name,
  category: r.category,
  price: r.price,
  stock: r.stock,
  maxStock: r.max_stock,
  productType: r.product_type,
  diameterIn: r.diameter_in,
  thicknessIn: r.thickness_in,
  lengthFt: r.length_ft,
  widthFt: r.width_ft,
  unit: r.unit,
  packSize: r.pack_size,
  lowStockThreshold: r.low_stock_threshold,
  isCuttable: r.is_cuttable,
});

// `order_id` links a delivery to its order. The "Order #12 - Name" text in
// `product` stays because every screen and the printed slip read it, but it is
// no longer the only link. `driver` goes up as null rather than "" so an
// unassigned delivery is not counted as assigned.
const deliveryToRow = (d) => ({
  id: d.id,
  order_id: d.orderId ?? null,
  product: d.product,
  size: d.size,
  location: d.location,
  amount: d.amount === '' || d.amount === undefined ? null : Number(d.amount),
  status: d.status,
  driver: d.driver?.trim() || null,
  // A `date` column: '' from an untouched form field is not a date.
  due_on: d.dueOn || null,
  created_at: d.createdAt,
  parent_delivery_id: d.parentDeliveryId ?? null,
  items_manifest: d.itemsManifest || [],
});

const deliveryFromRow = (r) => ({
  id: r.id,
  revision: r.revision ?? 0,
  orderId: r.order_id ?? null,
  product: r.product,
  size: r.size,
  location: r.location,
  amount: r.amount,
  status: r.status,
  driver: r.driver,
  dueOn: r.due_on,
  createdAt: r.created_at,
  parentDeliveryId: r.parent_delivery_id ?? null,
  itemsManifest: r.items_manifest || [],
});

// The per-line counters (committedUnits, voidedUnits) live inside `items`, so
// they need nothing here. refund_history and replacement_history are written
// by order_command; replacement_history is read-only from the browser.
const orderToRow = (o) => ({
  id: o.id,
  customer_name: o.customerName,
  // The link to the customer record where there is one. The name stays beside
  // it and stays what is displayed: a walk-in has no record at all.
  customer_id: o.customerId ?? null,
  items: o.items || [],
  total_amount: o.totalAmount,
  discount_amount: numOrNull(o.discountAmount) ?? 0,
  promotion: o.promotion ?? null,
  status: o.status,
  created_at: o.createdAt,
  stock_committed_at: o.stockCommittedAt || null,
  backorder_status: o.backorderStatus || 'none',
  refund_history: o.refundHistory || [],
  price_adjustments: o.priceAdjustments || [],
  refunded_amount: numOrNull(o.refundedAmount) ?? 0,
  // 30 or 60 days from delivery, or null for an order picked up at the shop.
  // Left undefined when a patch does not mention it, so it drops out of the
  // request rather than being sent as a change (only managers may change it).
  payment_term_days: o.paymentTermDays,
});

const orderFromRow = (r) => ({
  id: r.id,
  revision: r.revision ?? 0,
  customerName: r.customer_name,
  customerId: r.customer_id ?? null,
  items: r.items || [],
  totalAmount: r.total_amount,
  discountAmount: Number(r.discount_amount) || 0,
  promotion: r.promotion ?? null,
  status: r.status,
  createdAt: r.created_at,
  stockCommittedAt: r.stock_committed_at,
  paymentTermDays: r.payment_term_days ?? null,
  priorityPosition: r.priority_position ?? 0,
  backorderStatus: r.backorder_status || 'none',
  refundHistory: r.refund_history || [],
  replacementHistory: r.replacement_history || [],
  priceAdjustments: r.price_adjustments || [],
  refundedAmount: r.refunded_amount ?? 0,
});

// `username` goes up as null, not '', or the second account without one would
// collide with the first on the unique index. `email` goes up lowercased to
// match what Supabase Auth returns. `is_super_admin` and `dashboard_view` are
// read but never written here: the first only a superadmin may set, the second
// is each person's own preference (set_own_dashboard_view).
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
  revision: r.revision ?? 0,
  id: r.id,
  name: r.name,
  role: r.role,
  contactNumber: r.contact_number,
  status: r.status,
  email: r.email,
  username: r.username,
  isSuperAdmin: !!r.is_super_admin,
  dashboardView: r.dashboard_view || 'standard',
});

/**
 * The activity feed. Written only by the database (audit triggers and the
 * command functions), so there is no toRow. The original `title`/`date`
 * columns are still read for entries written before `staff_name`/`at` existed.
 */
const activityFromRow = (r) => ({
  source: r.source ?? 'legacy',
  id: r.id,
  type: r.type,
  title: r.title,
  description: r.description,
  amount: r.amount,
  date: r.date,
  staffName: r.staff_name,
  subject: r.subject,
  at: r.at,
});

// `kind` is NOT NULL with a default, so an unanswered field falls back to it.
const customerToRow = (c) => ({
  id: c.id,
  name: c.name,
  contact_number: c.contactNumber,
  email: c.email || null,
  address: c.address,
  kind: c.kind === 'business' ? 'business' : 'walk-in',
  // The term a new order of theirs starts with. Undefined drops out of a patch.
  payment_term_days: c.paymentTermDays,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

const customerFromRow = (r) => ({
  revision: r.revision ?? 0,
  id: r.id,
  name: r.name,
  contactNumber: r.contact_number,
  email: r.email,
  address: r.address,
  kind: r.kind || 'walk-in',
  paymentTermDays: r.payment_term_days ?? 30,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// The catalogue half of a product. `size` is a label derived from the
// dimensions, kept as a column so older readers keep working. `status` is
// Active or Archived; archiving is done by remove_product.
const productToRow = (p) => ({
  id: p.id,
  item_code: p.itemCode,
  name: p.name,
  size: p.size,
  unit_price: p.unitPrice === '' || p.unitPrice === undefined ? null : Number(p.unitPrice),
  low_stock_threshold:
    p.lowStockThreshold === '' || p.lowStockThreshold === undefined ? null : Number(p.lowStockThreshold),
  status: p.status || 'Active',
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
  revision: r.revision ?? 0,
  id: r.id,
  itemCode: r.item_code,
  name: r.name,
  size: r.size,
  unitPrice: r.unit_price,
  lowStockThreshold: r.low_stock_threshold,
  status: r.status || 'Active',
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
  revision: r.revision ?? 0,
  id: r.id,
  name: r.name,
  // Read, never written by the form: only remove_supplier and restore_supplier
  // change it (a trigger refuses anything else).
  status: r.status || 'Active',
  contactPerson: r.contact_person,
  contactNumber: r.contact_number,
  email: r.email,
  address: r.address,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const loyaltyToRow = (l) => ({
  enabled: !!l.enabled,
  regular_after_orders: intOr(l.regularAfterOrders, 3),
  reward_after_orders: intOr(l.rewardAfterOrders, 5),
  reward_percent: numOrNull(l.rewardPercent) ?? 5,
});

const loyaltyFromRow = (r) => ({
  id: r.id,
  revision: r.revision ?? 0,
  enabled: !!r.enabled,
  regularAfterOrders: r.regular_after_orders,
  rewardAfterOrders: r.reward_after_orders,
  rewardPercent: Number(r.reward_percent),
  updatedAt: r.updated_at,
  updatedBy: r.updated_by,
});

/** One row of public.customer_order_stats: a customer's whole history, summed. */
const customerStatsFromRow = (r) => ({
  id: r.customer_key,
  key: r.customer_key,
  orderCount: Number(r.order_count) || 0,
  completedCount: Number(r.completed_count) || 0,
  openCount: Number(r.open_count) || 0,
  spent: Number(r.spent) || 0,
  lastOrderAt: r.last_order_at,
});

const stockMovementFromRow = (r) => ({
  id: r.id,
  inventoryId: r.inventory_id,
  rawMaterialId: r.raw_material_id,
  itemCode: r.item_code,
  itemName: r.item_name,
  change: r.quantity_change,
  balanceAfter: r.balance_after,
  kind: r.kind,
  reason: r.reason,
  note: r.note,
  orderId: r.order_id,
  supplierOrderId: r.supplier_order_id,
  batchId: r.batch_id,
  actorName: r.actor_name,
  reversesMovementId: r.reverses_movement_id ?? null,
  at: r.created_at,
});

const identity = (x) => x;

// ---- reads ----------------------------------------------------------------

/**
 * How many rows one request asks for. The server may enforce a smaller cap,
 * so this is only the requested maximum.
 */
const PAGE = 500;

/**
 * Every row a query matches, in id order, however many pages that takes.
 *
 * PostgREST caps a response at the project's row limit and says so nowhere in
 * the body, so one select is not the whole table. This continues until an
 * empty page (a short page may just be the server's lower cap), using the last
 * primary key as the cursor, which avoids growing OFFSET scans and skipped rows
 * when an earlier page loses a record between requests.
 */
export const loadAllRows = async (table, refine = identity) => {
  const rows = [];
  let lastId = null;
  for (;;) {
    let query = refine(supabase.from(table).select('*')).order('id', { ascending: true }).limit(PAGE);
    if (lastId !== null) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    const nextId = data[data.length - 1].id;
    if (nextId == null || (lastId !== null && Number(nextId) <= Number(lastId))) {
      throw new Error(`The ${table} page did not advance.`);
    }
    lastId = nextId;
  }
  return rows;
};

// Set once the page starts going away (a reload or a navigation). The browser
// aborts every request still in flight at that moment, and each one used to be
// logged as a failed load -- noise that looked like a real outage.
let pageIsLeaving = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { pageIsLeaving = true; });
  window.addEventListener('pageshow', () => { pageIsLeaving = false; });
}

/** Reads that fail say so, rather than looking like an empty table. */
async function readRows(table, read, fromRow) {
  try {
    return { ok: true, data: (await read()).map(fromRow) };
  } catch (error) {
    // Still reported to the caller as a failed read; only the console is quiet
    // for a request the page itself cancelled.
    if (!pageIsLeaving && error?.name !== 'AbortError') console.error(`Failed to load ${table}:`, error);
    return { ok: false, data: [], error };
  }
}

/**
 * Open work plus recent history, plus any older record somebody opened.
 *
 * `since` is a yyyy-mm-dd date; without it the whole table is read (the "show
 * everything" choice on a list screen). `pinned` are ids of older records that
 * were opened directly; `pinnedOrders` pulls in the deliveries of such orders.
 */
function openOrRecent(openFilter) {
  const ids = (list = []) => list.filter((id) => Number.isSafeInteger(Number(id)));
  return (query, { since, pinned, pinnedOrders } = {}) => {
    if (!since) return query;
    const parts = [openFilter, `created_at.gte.${since}`];
    if (ids(pinned).length) parts.push(`id.in.(${ids(pinned).join(',')})`);
    if (ids(pinnedOrders).length) parts.push(`order_id.in.(${ids(pinnedOrders).join(',')})`);
    return query.or(parts.join(','));
  };
}
const openOrders = openOrRecent('status.eq.Pending');
const openDeliveries = openOrRecent('status.neq.Delivered');

/**
 * Turns anything Supabase hands back into a message worth showing a person.
 *
 * The database's own functions and guards raise messages written for staff
 * (P0001, and 40001 for "this changed under you"), so those pass through.
 * Constraint names are translated rather than shown.
 */
export const humanizeError = (error, fallback) => {
  if (!error) return fallback;
  const raw = error.message || String(error);

  if (['P0001', '40001'].includes(error.code)) return raw;
  if (error.code === '23505' || /duplicate key/i.test(raw)) {
    if (/email/i.test(raw)) return 'That email address is already in use.';
    if (/username/i.test(raw)) return 'That username is already taken.';
    if (/item_code|sku/i.test(raw)) return 'That item code is already in use.';
    return 'That record already exists.';
  }
  if (error.code === '23503') {
    return 'Other records still point at this one, so it has to stay.';
  }
  if (error.code === '23514' || /check constraint/i.test(raw)) {
    if (/role/i.test(raw)) return 'That is not a valid role.';
    if (/status/i.test(raw)) return 'That is not a valid status.';
    if (/contact_number/i.test(raw)) return 'That contact number is not one that can be dialled.';
    if (/stock/i.test(raw)) return 'There is not enough stock for that.';
    if (/price|amount/i.test(raw)) return 'That amount is outside the allowed range.';
    return 'One of the values is outside the allowed range.';
  }
  if (error.code === '22003' || /out of range/i.test(raw)) return 'That number is too large.';
  if (error.code === '42501' || /row-level security/i.test(raw)) return 'You do not have permission to do that.';
  if (/timeout|abort/i.test(raw)) return 'The request timed out. Check the connection and retry.';
  if (/fetch|network/i.test(raw)) return 'We could not reach the database. Check your connection and retry.';
  return fallback;
};

// ---- writes ---------------------------------------------------------------

/**
 * Insert one row. The id is the database's to pick (every table defaults it to
 * a sequence), so it is deleted from the payload rather than sent as null --
 * an explicit null does not fall back to the column default.
 */
const createRow = async (table, row, toRow = identity) => {
  const payload = toRow(row);
  if (payload.id === undefined || payload.id === null) delete payload.id;

  const { data, error } = await supabase.from(table).insert(payload).select().maybeSingle();
  if (error) {
    console.error(`Failed to insert into ${table}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't save that ${table} record.`) };
  }
  // RLS can accept the insert and still return nothing if the new row is
  // outside the caller's SELECT policy.
  return { ok: true, data };
};

/** Tables whose rows carry a revision: a save made from an older copy is refused. */
const VERSIONED = ['orders', 'deliveries', 'customers', 'suppliers', 'products', 'inventory', 'staff', 'loyalty_rules', 'business_settings'];

/**
 * Update one row by id. `id` is never part of the payload, so a mis-typed id
 * cannot silently repoint the row.
 */
const updateRow = async (table, id, patch, toRow = identity) => {
  const payload = toRow(patch);
  delete payload.id;

  let query = supabase.from(table).update(payload).eq('id', id);
  const versioned = VERSIONED.includes(table);
  if (versioned) query = query.eq('revision', patch.revision ?? 0);
  const { data, error } = await query.select().maybeSingle();

  if (error) {
    console.error(`Failed to update ${table} #${id}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't save your changes.`) };
  }
  // No error and no row: the revision moved on, or RLS filtered the row out.
  // Postgres reports both as success with nothing changed.
  if (!data) {
    return {
      ok: false,
      message: versioned
        ? 'This record changed or is no longer available. Refresh it before saving again.'
        : 'You do not have permission to change that record, or it no longer exists.',
    };
  }
  return { ok: true, data };
};

/** Delete one row by id. A delete blocked by RLS matches nothing, hence the count. */
const deleteRow = async (table, id) => {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
  if (error) {
    console.error(`Failed to delete ${table} #${id}:`, error);
    return { ok: false, error, message: humanizeError(error, `Couldn't delete that record.`) };
  }
  if (!count) return { ok: false, message: 'You do not have permission to delete that record.' };
  return { ok: true };
};

const without = (row, keys) => {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
};

/**
 * A collection definition: everything the hook and the write helpers need for
 * one table. `load(params)` reads it -- whole, or refined by `refine` -- and
 * `omitOnUpdate` lists columns only the database may change after insert.
 */
const collection = (table, fromRow = identity, toRow = identity, { refine, omitOnUpdate = [] } = {}) => ({
  table,
  fromRow,
  toRow,
  load: (params) => readRows(table, () => loadAllRows(table, (query) => (refine ? refine(query, params) : query)), fromRow),
  create: (row) => createRow(table, row, toRow),
  update: (id, patch) => updateRow(table, id, patch, (value) => without(toRow(value), omitOnUpdate)),
  remove: (id) => deleteRow(table, id),
});

export const inventoryCollection = collection('inventory', inventoryFromRow, inventoryToRow, { omitOnUpdate: ['stock'] });
export const deliveriesCollection = collection('deliveries', deliveryFromRow, deliveryToRow, { refine: openDeliveries });
export const ordersCollection = collection('orders', orderFromRow, orderToRow, { refine: openOrders });
export const staffCollection = collection('staff', staffFromRow, staffToRow);
export const customersCollection = collection('customers', customerFromRow, customerToRow);
export const productsCollection = collection('products', productFromRow, productToRow);
export const suppliersCollection = collection('suppliers', supplierFromRow, supplierToRow);
export const customerStatsCollection = {
  table: 'customer_order_stats',
  fromRow: customerStatsFromRow,
  load: () => readRows('customer_order_stats',
    async () => {
      const { data, error } = await supabase.from('customer_order_stats').select('*');
      if (error) throw error;
      return data ?? [];
    }, customerStatsFromRow),
};
export const loyaltyCollection = collection('loyalty_rules', loyaltyFromRow, loyaltyToRow);

/** A small table or view read whole in one request: no `id` to page by. */
const readWhole = (table, fromRow) => readRows(table, async () => {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data ?? [];
}, fromRow);

// ---- payments ---------------------------------------------------------------

/** What each order has been paid so far (the order_paid view): one row per order with any payment. */
const orderPaidFromRow = (r) => ({
  orderId: Number(r.order_id),
  paid: Number(r.paid_amount) || 0,
  count: Number(r.payment_count) || 0,
  lastPaidOn: r.last_paid_on,
});
export const orderPaidCollection = {
  table: 'order_paid',
  fromRow: orderPaidFromRow,
  load: () => readWhole('order_paid', orderPaidFromRow),
};

const paymentFromRow = (r) => ({
  id: Number(r.id),
  orderId: Number(r.order_id),
  amount: Number(r.amount),
  method: r.method,
  reference: r.reference,
  receivedOn: r.received_on,
  note: r.note,
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});

/** One order's payments, oldest first. */
export async function fetchOrderPayments(orderId) {
  return readRows('order_payments', async () => {
    const { data, error } = await supabase.from('order_payments').select('*').eq('order_id', orderId)
      .order('received_on', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, paymentFromRow);
}

/**
 * Records money received against one or more orders; record_payment settles
 * them oldest first. `requestId` stays the same across a retry, so a lost
 * response is never recorded twice.
 */
export async function recordPayment({ orderIds, amount, method, reference = null, receivedOn, note = null, requestId }) {
  const { data, error } = await supabase.rpc('record_payment', {
    p_order_ids: orderIds,
    p_amount: Number(amount),
    p_method: method,
    p_reference: reference || null,
    p_received_on: receivedOn,
    p_note: note || null,
    p_request_id: requestId,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't record that payment.") };
  return { ok: true, data: (data?.payments ?? []).map(paymentFromRow) };
}

/** Removes a payment entered by mistake. Managers only. */
export async function removePayment(paymentId) {
  const { error } = await supabase.rpc('remove_payment', { p_payment_id: paymentId });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't remove that payment.") };
  return { ok: true };
}

// ---- the business's own settings -------------------------------------------

const timeOrNull = (value) => (value ? String(value).slice(0, 5) : null);
const blankToNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim());

const businessSettingsFromRow = (r) => ({
  id: r.id,
  revision: r.revision ?? 0,
  businessName: r.business_name ?? 'LSB Handicrafts',
  tin: r.tin ?? '',
  phone: r.phone ?? '',
  email: r.email ?? '',
  address: r.address ?? '',
  vatRegistered: !!r.vat_registered,
  deliveryFee: r.delivery_fee == null ? null : Number(r.delivery_fee),
  freeDeliveryFrom: r.free_delivery_from == null ? null : Number(r.free_delivery_from),
  deliveryAreas: r.delivery_areas ?? [],
  openDays: r.open_days ?? [],
  opensAt: timeOrNull(r.opens_at),
  closesAt: timeOrNull(r.closes_at),
  updatedAt: r.updated_at,
  updatedBy: r.updated_by,
});
const businessSettingsToRow = (b) => ({
  business_name: String(b.businessName ?? '').trim(),
  tin: blankToNull(b.tin),
  phone: blankToNull(b.phone),
  email: blankToNull(b.email),
  address: blankToNull(b.address),
  vat_registered: !!b.vatRegistered,
  delivery_fee: numOrNull(b.deliveryFee),
  free_delivery_from: numOrNull(b.freeDeliveryFrom),
  delivery_areas: b.deliveryAreas ?? [],
  open_days: b.openDays ?? [],
  opens_at: b.opensAt || null,
  closes_at: b.closesAt || null,
});
/** One row, read by everyone and changed by an administrator, with a revision like loyalty_rules. */
export const businessSettingsCollection = collection('business_settings', businessSettingsFromRow, businessSettingsToRow);

// ---- staff photos and sessions ----------------------------------------------

const staffPhotoFromRow = (r) => ({ staffId: Number(r.staff_id), dataUrl: r.data_url });
/** Every staff photo. One small square per person, so it is read whole. */
export const staffPhotosCollection = {
  table: 'staff_photos',
  fromRow: staffPhotoFromRow,
  load: () => readWhole('staff_photos', staffPhotoFromRow),
};

/** Sets or replaces the signed-in person's own photo; null removes it. */
export async function saveOwnPhoto(dataUrl) {
  const { error } = await supabase.rpc('save_own_photo', { p_data_url: dataUrl });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't save your photo.") };
  return { ok: true };
}

// ---- notifications ----------------------------------------------------------

const notificationFromRow = (r) => ({
  id: Number(r.id),
  event: r.event,
  title: r.title,
  body: r.body,
  view: r.view,
  recordId: r.record_id == null ? null : Number(r.record_id),
  createdAt: r.created_at,
  readAt: r.read_at,
});

/** The signed-in person's newest alerts. Row level security keeps them to their own. */
export const notificationsCollection = {
  table: 'notifications',
  fromRow: notificationFromRow,
  load: () => readRows('notifications', async () => {
    const { data, error } = await supabase.from('notifications').select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  }, notificationFromRow),
};

/** Marks the given alerts read. Only the caller's own can be, and only read_at. */
export async function markNotificationsRead(ids) {
  if (!ids?.length) return { ok: true };
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  if (error) return { ok: false, message: humanizeError(error, "Couldn't mark those as read.") };
  return { ok: true };
}

/** Asks the database to raise the clock-driven alerts: late deliveries and overdue payments. */
export async function refreshAlerts() {
  const { error } = await supabase.rpc('refresh_alerts');
  return error ? { ok: false, message: humanizeError(error, "Couldn't check for new alerts.") } : { ok: true };
}

/** The caller's own choice of events, or null when they have never saved one. */
export async function fetchNotificationSettings() {
  try {
    const { data, error } = await supabase.from('notification_settings').select('in_app').limit(1);
    if (error) throw error;
    return { ok: true, data: data?.[0]?.in_app ?? null };
  } catch (error) {
    return { ok: false, data: null, error };
  }
}

/** Saves the caller's own choice; the database drops anything their role may not hear about. */
export async function saveNotificationSettings(events) {
  const { data, error } = await supabase.rpc('save_notification_settings', { p_in_app: events });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't save your notification settings.") };
  return { ok: true, data: data?.in_app ?? events };
}

/** Sets how a supplier order is paid: 'cod' or 'card'. Managers, until it arrives. */
export async function setSupplierPayment(orderId, method) {
  const { data, error } = await supabase.rpc('set_supplier_payment', { p_order_id: orderId, p_method: method });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't change how that order is paid.") };
  return { ok: true, data };
}

/** Ends every session of another staff member's login. Administrators only. */
export async function signOutStaff(staffId) {
  const { data, error } = await supabase.rpc('sign_out_staff', { p_staff_id: staffId });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't sign them out.") };
  return { ok: true, ended: Number(data?.ended ?? 0) };
}

/**
 * The newest `limit` activity entries. The feed grows with every change to
 * every record, so it is never read whole; the activity screen asks for more.
 */
export const activityLogCollection = {
  table: 'activity_log',
  fromRow: activityFromRow,
  load: ({ limit = 200 } = {}) => readRows('activity_log', async () => {
    const { data, error } = await supabase.from('activity_log').select('*')
      .order('at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }, activityFromRow),
};

/** The newest activity entries about one record (its `subject`), newest first. */
export async function fetchActivityFor(subject, limit = 50) {
  return readRows('activity_log', async () => {
    const { data, error } = await supabase.from('activity_log').select('*').eq('subject', subject)
      .order('at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }, activityFromRow);
}

/** One product's or material's stock history, newest first. */
export async function fetchStockMovements({ inventoryId = null, rawMaterialId = null, limit = 50 }) {
  return readRows('stock_movements', async () => {
    let query = supabase.from('stock_movements').select('*');
    query = inventoryId != null ? query.eq('inventory_id', inventoryId) : query.eq('raw_material_id', rawMaterialId);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }, stockMovementFromRow);
}

/** Escapes a value for an ilike match so it matches only itself. */
const literalPattern = (text) => String(text ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * One customer's orders, newest first, found by id or -- for orders that carry
 * no id -- by the name they were written under, as utils/customers does.
 */
export async function fetchCustomerOrders(customer, limit = 50) {
  return readRows('orders', async () => {
    const byId = supabase.from('orders').select('*').eq('customer_id', customer.id)
      .order('created_at', { ascending: false }).limit(limit);
    const byName = supabase.from('orders').select('*').is('customer_id', null)
      .ilike('customer_name', literalPattern(customer.name))
      .order('created_at', { ascending: false }).limit(limit);
    const [a, b] = await Promise.all([byId, byName]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    return [...(a.data ?? []), ...(b.data ?? [])]
      .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
      .slice(0, limit);
  }, orderFromRow);
}

/**
 * Removes a product the only safe way: archived if anything refers to it,
 * deleted (both halves, in one transaction) if nothing does.
 */
export async function removeProduct(product) {
  const { data, error } = await supabase.rpc('remove_product', {
    p_product_id: product.id,
    p_expected_revision: product.revision ?? 0,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't remove that product.") };
  return { ok: true, outcome: data?.outcome ?? 'deleted' };
}

/**
 * Removes a raw material the same way: archived if any delivery, batch, recipe,
 * lot or movement refers to it -- or if there is still stock on the shelf --
 * and deleted outright only when nothing does. Archiving is reversible.
 */
export async function removeMaterial(material) {
  const { data, error } = await supabase.rpc('remove_material', {
    p_material_id: material.id,
    p_expected_revision: material.revision ?? 0,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't remove that raw material.") };
  return { ok: true, outcome: data?.outcome ?? 'deleted' };
}

// ---- categories and product photos ----------------------------------------

/**
 * The category list. Read here; changed only through category_command, which
 * keeps one spelling per category (see the migration of 2026-09-29).
 */
export const categoriesCollection = {
  table: 'product_categories',
  fromRow: (r) => ({ id: r.id, name: r.name }),
  load: () => readRows('product_categories', () => loadAllRows('product_categories'), (r) => ({ id: r.id, name: r.name })),
};

/**
 * Adds, renames or removes a category. An add that matches an existing name in
 * any capitalisation answers with that category rather than a second one.
 */
export async function runCategoryCommand(action, data) {
  const { data: result, error } = await supabase.rpc('category_command', { p_action: action, p_data: data });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't change the category list.") };
  return { ok: true, data: result };
}

/** One product's photo as a data URL, or null when it has none. */
export async function fetchProductImage(productId) {
  try {
    const { data, error } = await supabase.from('product_images').select('*').eq('product_id', productId).limit(1);
    if (error) throw error;
    const row = data?.[0] ?? null;
    return { ok: true, data: row ? { dataUrl: row.data_url, updatedAt: row.updated_at, updatedBy: row.updated_by } : null };
  } catch (error) {
    console.error('Failed to load the product photo:', error);
    return { ok: false, data: null, error };
  }
}

/** Sets or replaces a product's photo; `dataUrl` null removes it. */
export async function saveProductImage(productId, dataUrl) {
  const { data, error } = await supabase.rpc('save_product_image', { p_product_id: productId, p_data_url: dataUrl });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't save the photo.") };
  return { ok: true, data };
}

/** Puts an archived raw material back in use. */
export async function restoreMaterial(material) {
  const { data, error } = await supabase.rpc('restore_material', {
    p_material_id: material.id,
    p_expected_revision: material.revision ?? 0,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't put that raw material back in use.") };
  return { ok: true, outcome: data?.outcome ?? 'restored' };
}

/**
 * Removes a supplier the way a material is removed: remove_supplier archives
 * one with purchase history and deletes one nobody ever ordered from. It
 * refuses while an order from them is still coming, and for anyone but an
 * administrator.
 */
export async function removeSupplier(supplier) {
  const { data, error } = await supabase.rpc('remove_supplier', {
    p_supplier_id: supplier.id,
    p_expected_revision: supplier.revision ?? 0,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't remove that supplier.") };
  return { ok: true, outcome: data?.outcome ?? 'deleted' };
}

/** Puts a supplier who is no longer used back in use. */
export async function restoreSupplier(supplier) {
  const { data, error } = await supabase.rpc('restore_supplier', {
    p_supplier_id: supplier.id,
    p_expected_revision: supplier.revision ?? 0,
  });
  if (error) return { ok: false, message: humanizeError(error, "Couldn't put that supplier back in use.") };
  return { ok: true, outcome: data?.outcome ?? 'restored' };
}

// ---- the signed-in person's own profile -----------------------------------

/**
 * Saves the signed-in person's own name and contact number through an RPC that
 * updates exactly those two columns on exactly the caller's row -- a policy
 * permissive enough for that would also let them change their own role.
 */
export const saveOwnProfile = async ({ name, contactNumber }) => {
  const { error } = await supabase.rpc('update_own_profile', {
    p_name: name ?? '',
    p_contact_number: contactNumber ?? '',
  });
  if (error) {
    console.error('Failed to save your profile:', error);
    return { ok: false, error, message: humanizeError(error, "Couldn't save your profile.") };
  }
  return { ok: true };
};

/** Saves which dashboard the signed-in person wants to see. */
export const saveOwnDashboardView = async (view) => {
  const { error } = await supabase.rpc('set_own_dashboard_view', { p_view: view });
  if (error) {
    console.error('Failed to save your dashboard preference:', error);
    return { ok: false, error, message: humanizeError(error, "Couldn't save how your dashboard looks.") };
  }
  return { ok: true };
};

// ---- the sign-in behind a staff account ------------------------------------

/**
 * Deletes the Supabase Auth user for a staff account, through the
 * `delete-staff-auth-user` Edge Function: it needs the service-role key, which
 * must never be in this bundle. Removing the staff row already revokes access;
 * this frees the email address so the person can be added again.
 */
export const deleteStaffAuthUser = async ({ userId = null, email = null } = {}) => {
  const { data, error } = await supabase.functions.invoke('delete-staff-auth-user', {
    body: { userId, email },
  });

  if (error) {
    // supabase-js flattens every non-2xx into one generic message; the function
    // writes a real sentence into the body.
    let detail = null;
    try {
      detail = (await error.context?.json())?.error ?? null;
    } catch {
      // Not JSON: a gateway error, or the function is not deployed.
    }
    console.error('Failed to remove the sign-in behind a staff account:', error);
    return { ok: false, error, message: detail || humanizeError(error, "Couldn't remove their sign-in.") };
  }

  // `deleted: false` means there was no Auth user to remove -- the state wanted.
  return { ok: true, deleted: !!data?.deleted };
};
