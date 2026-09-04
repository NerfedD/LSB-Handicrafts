/**
 * The fake database the smoke test runs against.
 *
 * Rows are in DATABASE shape (snake_case), not app shape, because they are
 * served through a stub standing in for PostgREST — so the mappers in
 * utils/storageManager are exercised too, and a column renamed in the schema
 * without being renamed in the mapper shows up as a blank cell in a screenshot
 * rather than passing silently.
 *
 * The data is chosen to put every screen into an interesting state at once:
 * stock that is plentiful, low and run out; orders waiting, done and cancelled;
 * a delivery in each of the five stages, one of them late and one with nobody
 * assigned; a customer who has not ordered in a year; and a blocked account.
 * A fixture where everything is fine tests nothing.
 */

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const day = (offset) => {
  const d = new Date(Date.now() + offset * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export const SIGNED_IN_EMAIL = "maria.santos@lsbhandicrafts.test";

export const staff = [
  {
    id: 1,
    name: "Maria Santos",
    role: "Admin",
    contact_number: "0917 555 0101",
    status: "Active",
    email: SIGNED_IN_EMAIL,
    username: "maria.santos",
    is_super_admin: true,
    dashboard_view: "standard",
  },
  {
    id: 2,
    name: "Juan Dela Cruz",
    role: "Sales Staff",
    contact_number: "0917 555 0102",
    status: "Active",
    email: "juan@lsbhandicrafts.test",
    username: "juan",
    is_super_admin: false,
    dashboard_view: "standard",
  },
  {
    id: 3,
    name: "Ana Reyes",
    role: "Production Staff",
    contact_number: "0917 555 0103",
    status: "Blocked",
    email: "ana@lsbhandicrafts.test",
    username: null,
    is_super_admin: false,
    dashboard_view: "large",
  },
  {
    id: 4,
    name: "Ramon Garcia",
    role: "Delivery Staff",
    contact_number: "0917 555 0104",
    status: "Active",
    email: "ramon@lsbhandicrafts.test",
    username: null,
    is_super_admin: false,
    dashboard_view: "standard",
  },
];

/** The catalogue. Item codes match the inventory SKUs below — that is the join. */
export const products = [
  { id: 1, item_code: "SB-040", name: 'Styro Ball 4 inch', size: "Styro Balls", unit_price: 120, low_stock_threshold: 20, status: "Active", created_at: iso(400), updated_at: iso(9), product_type: "ball", diameter_in: 4, thickness_in: null, length_ft: null, width_ft: null, unit: "piece", pack_size: 1 },
  { id: 2, item_code: "SB-060", name: 'Styro Ball 6 inch', size: "Styro Balls", unit_price: 185, low_stock_threshold: 15, status: "Active", created_at: iso(380), updated_at: iso(30), product_type: "ball", diameter_in: 6, thickness_in: null, length_ft: null, width_ft: null, unit: "piece", pack_size: 1 },
  { id: 3, item_code: "SS-100", name: 'Styro Sheet 1 inch', size: "Styro Sheets", unit_price: 240, low_stock_threshold: 25, status: "Active", created_at: iso(360), updated_at: iso(4), product_type: "sheet", diameter_in: null, thickness_in: 1, length_ft: 4, width_ft: 2, unit: "sheet", pack_size: 1 },
  { id: 4, item_code: "SS-050", name: 'Styro Sheet 1/2 inch', size: "Styro Sheets", unit_price: 150, low_stock_threshold: 25, status: "Active", created_at: iso(350), updated_at: iso(60), product_type: "sheet", diameter_in: null, thickness_in: 0.5, length_ft: 4, width_ft: 2, unit: "bundle", pack_size: 10 },
  { id: 5, item_code: "SL-200", name: "Styro Block 2 inch", size: "Styro Blocks", unit_price: 420, low_stock_threshold: 10, status: "Active", created_at: iso(300), updated_at: iso(120), product_type: "block", diameter_in: null, thickness_in: 2, length_ft: 4, width_ft: 2, unit: "piece", pack_size: 1 },
  { id: 6, item_code: "SX", name: "Carved centrepiece base", size: "Custom shapes", unit_price: 850, low_stock_threshold: null, status: "Active", created_at: iso(120), updated_at: iso(120), product_type: "other", diameter_in: null, thickness_in: null, length_ft: null, width_ft: null, unit: "piece", pack_size: 1 },
];

/**
 * The stock ledger. Deliberately covers all four cases the products screen can
 * show: plenty, running low, run out, and one product with no row at all
 * ("SX" is absent, so it reports "Not tracked" rather than zero).
 */
export const inventory = [
  { id: 101, sku: "SB-040", name: 'Styro Ball 4 inch', category: "Styro Balls", price: 120, stock: 140, max_stock: 200, status: "In Stock", product_type: "ball", diameter_in: 4, thickness_in: null, length_ft: null, width_ft: null, unit: "piece", pack_size: 1, low_stock_threshold: 20, reserved: 0, is_cuttable: false },
  { id: 102, sku: "SB-060", name: 'Styro Ball 6 inch', category: "Styro Balls", price: 185, stock: 12, max_stock: 120, status: "Low Stock", product_type: "ball", diameter_in: 6, thickness_in: null, length_ft: null, width_ft: null, unit: "piece", pack_size: 1, low_stock_threshold: 15, reserved: 0, is_cuttable: false },
  { id: 103, sku: "SS-100", name: 'Styro Sheet 1 inch', category: "Styro Sheets", price: 240, stock: 0, max_stock: 80, status: "Out of Stock", product_type: "sheet", diameter_in: null, thickness_in: 1, length_ft: 4, width_ft: 2, unit: "sheet", pack_size: 1, low_stock_threshold: 25, reserved: 0, is_cuttable: true },
  { id: 104, sku: "SS-050", name: 'Styro Sheet 1/2 inch', category: "Styro Sheets", price: 150, stock: 64, max_stock: 100, status: "In Stock", product_type: "sheet", diameter_in: null, thickness_in: 0.5, length_ft: 4, width_ft: 2, unit: "bundle", pack_size: 10, low_stock_threshold: 25, reserved: 0, is_cuttable: true },
  { id: 105, sku: "SL-200", name: "Styro Block 2 inch", category: "Styro Blocks", price: 420, stock: 9, max_stock: 40, status: "Low Stock", product_type: "block", diameter_in: null, thickness_in: 2, length_ft: 4, width_ft: 2, unit: "piece", pack_size: 1, low_stock_threshold: 10, reserved: 0, is_cuttable: false },
];

export const customers = [
  { id: 201, name: "Reyes Events", contact_number: "0917 555 0201", email: "hello@reyesevents.test", address: "12 Mabini St, Poblacion, Davao City", kind: "business", created_at: iso(500), updated_at: iso(10) },
  { id: 202, name: "Liza Villanueva", contact_number: "0917 555 0202", email: null, address: "8 Bonifacio Ext, Agdao, Davao City", kind: "walk-in", created_at: iso(12), updated_at: iso(12) },
  { id: 203, name: "Carlos Mendoza", contact_number: "0917 555 0203", email: null, address: "44 Quimpo Blvd, Matina, Davao City", kind: "walk-in", created_at: iso(600), updated_at: iso(600) },
  { id: 204, name: "Bloom & Co", contact_number: "0917 555 0204", email: "orders@bloomco.test", address: "3 Torres St, Poblacion, Davao City", kind: "business", created_at: iso(200), updated_at: iso(45) },
];

export const suppliers = [
  { id: 301, name: "Davao Foam Supply", contact_person: "Ramon", contact_number: "082 555 0301", email: "sales@davaofoam.test", address: "Km 7, Lanang, Davao City", created_at: iso(700), updated_at: iso(90) },
  { id: 302, name: "Southern Adhesives", contact_person: "Belen", contact_number: "082 555 0302", email: null, address: "19 Cabaguio Ave, Agdao, Davao City", created_at: iso(400), updated_at: iso(200) },
];

export const orders = [
  { id: 1041, customer_name: "Reyes Events", items: [ { kind: "catalog", productId: 101, name: 'Styro Ball 4 inch', quantity: 40, unitPrice: 120, lineTotal: 4800, stockUnits: 40 }, { kind: "cut", name: 'Styro Sheet 1 inch, cut to 2ft x 1ft', quantity: 12, unitPrice: 90, lineTotal: 1080, stockUnits: 3, notes: "Cut to 2ft × 1ft for the stage backdrop" } ], total_amount: 6280, status: "Pending", created_at: iso(6), stock_committed_at: null },
  { id: 1042, customer_name: "Liza Villanueva", items: [ { kind: "catalog", productId: 104, name: 'Styro Sheet 1/2 inch', quantity: 4, unitPrice: 150, lineTotal: 600, stockUnits: 4 } ], total_amount: 600, status: "Pending", created_at: iso(1), stock_committed_at: null },
  { id: 1043, customer_name: "Bloom & Co", items: [ { kind: "catalog", productId: 102, name: 'Styro Ball 6 inch', quantity: 25, unitPrice: 185, lineTotal: 4625, stockUnits: 25 } ], total_amount: 4625, status: "Completed", created_at: iso(20), stock_committed_at: iso(16) },
  { id: 1044, customer_name: "Carlos Mendoza", items: [ { kind: "catalog", productId: 105, name: "Styro Block 2 inch", quantity: 2, unitPrice: 420, lineTotal: 840, stockUnits: 2 } ], total_amount: 840, status: "Cancelled", created_at: iso(40), stock_committed_at: null },
];

export const deliveries = [
  { id: 2041, product: "Order #1041 - Reyes Events", size: "40 × Styro Ball 4 inch, 12 × cut sheet", location: "12 Mabini St, Poblacion", amount: 350, status: "Being Made", driver: null, due_on: day(-2), created_at: iso(6) },
  { id: 2042, product: "Order #1042 - Liza Villanueva", size: "4 × Styro Sheet 1/2 inch", location: "8 Bonifacio Ext, Agdao", amount: 0, status: "Ready To Go", driver: "Ramon Garcia", due_on: day(0), created_at: iso(1) },
  { id: 2043, product: "Order #1043 - Bloom & Co", size: "25 × Styro Ball 6 inch", location: "3 Torres St, Poblacion", amount: 200, status: "Delivered", driver: "Ramon Garcia", due_on: day(-14), created_at: iso(20) },
  { id: 2044, product: "Walk-in - Cielo Dizon", size: "6 × Styro Ball 4 inch", location: "Km 9, Matina, Davao City", amount: 150, status: "On The Way", driver: "Ramon Garcia", due_on: day(0), created_at: iso(2) },
  { id: 2045, product: "Order #1045 - Parish of San Pedro", size: "2 × Styro Block 2 inch", location: "San Pedro St, Poblacion", amount: 250, status: "Not Yet Delivered", driver: null, due_on: day(3), created_at: iso(1) },
];

export const activity_log = [
  { id: 9001, type: "sign-in", title: null, description: "signed in", amount: null, status: null, color: null, date: null, staff_name: "Maria Santos", subject: null, at: iso(0.02) },
  { id: 9002, type: "stock", title: null, description: "recorded 60 × Styro Ball 4 inch made", amount: 60, status: null, color: null, date: null, staff_name: "Ana Reyes", subject: "SB-040", at: iso(0.2) },
  { id: 9003, type: "price", title: null, description: "changed the price of Styro Sheet 1 inch to ₱240.00", amount: null, status: null, color: null, date: null, staff_name: "Maria Santos", subject: "SS-100", at: iso(1.1) },
  { id: 9004, type: "order", title: null, description: "wrote order #1041 for Reyes Events", amount: 6280, status: null, color: null, date: null, staff_name: "Juan Dela Cruz", subject: "order:1041", at: iso(6) },
  { id: 9005, type: "delivery", title: null, description: "moved delivery #2044 to on the way", amount: null, status: null, color: null, date: null, staff_name: "Ramon Garcia", subject: "delivery:2044", at: iso(2) },
  { id: 9006, type: "stock", title: null, description: "sold 25 × Styro Ball 6 inch on order #1043", amount: -25, status: null, color: null, date: null, staff_name: "Maria Santos", subject: "SB-060", at: iso(16) },
  // A row in the OLD shape, written by the legacy workspace before the columns
  // that replaced these existed. It must still render rather than showing a
  // blank line — see the fallbacks in utils/activityLog.read().
  { id: 9007, type: "order", title: "Order Deleted", description: "Deleted order #1039 for Walk-in", amount: 400, status: null, color: "bg-red-500", date: "August 22, 2026", staff_name: null, subject: null, at: null },
];

export const TABLES = {
  staff,
  products,
  inventory,
  customers,
  suppliers,
  orders,
  deliveries,
  activity_log,
};
