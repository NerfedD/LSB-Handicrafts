/**
 * Which tables each screen needs, so nothing is read before somebody opens a
 * screen that uses it -- and nothing is re-read in the background while nobody
 * is looking at it.
 *
 * Products, stock, orders and deliveries are not listed: the sidebar's counts
 * need them on every screen, and orders and deliveries are already bounded to
 * open work plus recent history (see utils/storageManager). Staff are read by
 * App itself, because the signed-in person's own row is among them.
 */
import { can } from './permissions';

const WORKSHOP = ['rawMaterials', 'materialOrders', 'batches', 'recipes', 'defects', 'lots', 'usage'];
const CUSTOMER_FACTS = ['customers', 'customerStats', 'loyalty'];

const BY_VIEW = {
  dashboard: [...CUSTOMER_FACTS, 'suppliers', 'activity', 'rawMaterials', 'batches'],
  customers: CUSTOMER_FACTS,
  'customer-detail': CUSTOMER_FACTS,
  'order-form': CUSTOMER_FACTS,
  'order-edit': CUSTOMER_FACTS,
  'order-detail': ['customers'],
  suppliers: ['suppliers'],
  'supplier-detail': ['suppliers', 'materialOrders', 'rawMaterials'],
  activity: ['activity'],
  'raw-materials': ['suppliers', ...WORKSHOP],
  'raw-material-detail': ['suppliers', ...WORKSHOP],
  'raw-material-orders': ['suppliers', ...WORKSHOP],
  production: ['suppliers', ...WORKSHOP],
  'production-report': ['suppliers', ...WORKSHOP],
};

/**
 * @param {string} view            the screen on show
 * @param {object} options
 * @param {string} options.role    the signed-in person's role
 * @param {string[]} options.open  collections an open dialog needs
 */
export function collectionsFor(view, { role, open = [] } = {}) {
  const wanted = new Set([...(BY_VIEW[view] ?? []), ...open]);
  // Only a manager's dashboard raises the raw-material reminder.
  if (view === 'dashboard' && !can(role, 'manageSuppliers') && !open.length) {
    wanted.delete('rawMaterials');
    wanted.delete('batches');
  }
  // Nothing to read for a role the database would answer with no rows anyway.
  if (!can(role, 'viewCustomers')) {
    wanted.delete('customers');
    wanted.delete('customerStats');
  }
  return wanted;
}

/** What each dialog opened from the app root needs while it is open. */
export const DIALOG_NEEDS = {
  customer: ['customers'],
  supplier: ['suppliers'],
  startBatch: WORKSHOP,
};
